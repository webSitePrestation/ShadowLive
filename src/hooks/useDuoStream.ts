'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createAgoraClient,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from '@/lib/agora/client';
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from '@/lib/agora/client';

export interface DuoUser {
  uid: string | number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  isHost: boolean;
}

interface UseDuoStreamOptions {
  channelName: string;
  uid: number;
  role: 'host' | 'audience';
  enabled: boolean;
}

async function canOpenMedia(constraints: MediaStreamConstraints): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

function getReadableAgoraError(err: unknown): string {
  const unknownMessage = 'Impossible de rejoindre le live.';
  if (!(err instanceof Error)) return unknownMessage;
  const code = (err as Error & { code?: string }).code;
  const message = err.message ?? '';

  if (code === 'DEVICE_NOT_FOUND' || message.includes('DEVICE_NOT_FOUND')) {
    return 'Aucune camera/micro detecte(e). Branche un appareil et autorise l acces navigateur.';
  }
  if (code === 'NOT_ALLOWED' || message.includes('NotAllowedError')) {
    return 'Acces camera/micro refuse. Autorise les permissions du site puis reessaie.';
  }
  if (code === 'WEB_SECURITY_RESTRICT' || message.includes('WEB_SECURITY_RESTRICT')) {
    return 'Contexte non securise. Utilise https ou localhost pour activer camera/micro.';
  }
  return message || unknownMessage;
}

function isMediaCaptureAllowedInThisContext(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  return window.isSecureContext || isLocalhost;
}

export function useDuoStream({ channelName, uid, role, enabled }: UseDuoStreamOptions) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<DuoUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const getToken = useCallback(async () => {
    const res = await fetch('/api/agora/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, uid, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error ?? 'Token API error');
    }
    if (!data?.token || !data?.appId) {
      throw new Error('Agora token response is invalid');
    }
    return { token: data.token as string, appId: data.appId as string };
  }, [channelName, uid, role]);

  const join = useCallback(async () => {
    if (clientRef.current || !enabled) return;

    try {
      const insecureHostContext = role === 'host' && !isMediaCaptureAllowedInThisContext();
      if (insecureHostContext) {
        setJoined(false);
        setError(null);
        return;
      }

      const client = await createAgoraClient();
      clientRef.current = client;

      await client.setClientRole(role === 'host' ? 'host' : 'audience');

      const { token, appId } = await getToken();
      await client.join(appId, channelName, token, uid);

      setJoined(true);

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => u.uid === user.uid ? {
              ...u,
              videoTrack: mediaType === 'video' ? user.videoTrack : u.videoTrack,
              audioTrack: mediaType === 'audio' ? user.audioTrack : u.audioTrack,
            } : u);
          }
          return [...prev, {
            uid: user.uid,
            videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
            audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
            isHost: false,
          }];
        });
        if (mediaType === 'audio') user.audioTrack?.play();
      });

      if (role === 'host') {
        try {
          let audioTrack: IMicrophoneAudioTrack | null = null;
          let videoTrack: ICameraVideoTrack | null = null;

          const audioAvailable = await canOpenMedia({ audio: true, video: false });
          const videoAvailable = await canOpenMedia({ audio: false, video: true });

          if (audioAvailable) {
            try {
              audioTrack = await createLocalAudioTrack();
            } catch (audioErr) {
              console.warn('[Duo] Agora audio track unavailable:', audioErr);
            }
          }

          if (videoAvailable) {
            try {
              videoTrack = await createLocalVideoTrack();
            } catch (videoErr) {
              console.warn('[Duo] Agora video track unavailable:', videoErr);
            }
          }

          const tracksToPublish = [audioTrack, videoTrack].filter(Boolean) as (
            IMicrophoneAudioTrack | ICameraVideoTrack
          )[];
          if (tracksToPublish.length > 0) {
            await client.publish(tracksToPublish);
          }

          setLocalAudioTrack(audioTrack);
          setLocalVideoTrack(videoTrack);

          if (!audioTrack && !videoTrack) {
            setError('Aucun micro/camera detecte. Live lance sans publication locale.');
          } else if (!audioTrack || !videoTrack) {
            setError('Micro ou camera indisponible. Live lance en mode degrade.');
          } else {
            setError(null);
          }
        } catch (deviceErr) {
          console.error('[Duo] Agora device error:', deviceErr);
          setError(getReadableAgoraError(deviceErr));
        }
      }

      client.on('user-unpublished', (user, mediaType) => {
        setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? {
          ...u,
          videoTrack: mediaType === 'video' ? undefined : u.videoTrack,
          audioTrack: mediaType === 'audio' ? undefined : u.audioTrack,
        } : u));
      });

      client.on('user-left', (user) => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });
    } catch (err) {
      console.error('[Duo] Agora join error:', err);
      setError(getReadableAgoraError(err));
    }
  }, [channelName, uid, role, enabled, getToken]);

  const leave = useCallback(async () => {
    localAudioTrack?.close();
    localVideoTrack?.close();
    await clientRef.current?.leave();
    clientRef.current = null;
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setJoined(false);
  }, [localAudioTrack, localVideoTrack]);

  const toggleMic = useCallback(async () => {
    if (!localAudioTrack) return;
    await localAudioTrack.setMuted(!micMuted);
    setMicMuted(m => !m);
  }, [localAudioTrack, micMuted]);

  const toggleCam = useCallback(async () => {
    if (!localVideoTrack) return;
    await localVideoTrack.setMuted(!camOff);
    setCamOff(c => !c);
  }, [localVideoTrack, camOff]);

  useEffect(() => {
    if (!enabled) {
      void leave();
      return;
    }
    void join();
    return () => {
      void leave();
    };
    // role/channel/uid : reconnexion Agora quand le soumis passe en co-host (duo)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leave/join volontairement exclus (tracks mutent leave)
  }, [enabled, role, channelName, uid]);

  return {
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    joined,
    error,
    micMuted,
    camOff,
    toggleMic,
    toggleCam,
    leave,
  };
}
