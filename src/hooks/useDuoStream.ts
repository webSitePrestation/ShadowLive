'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createAgoraClient, createLocalTracks } from '@/lib/agora/client';
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
    return { token: data.token as string, appId: data.appId as string };
  }, [channelName, uid, role]);

  const join = useCallback(async () => {
    if (clientRef.current || !enabled) return;

    try {
      const client = await createAgoraClient();
      clientRef.current = client;

      await client.setClientRole(role === 'host' ? 'host' : 'audience');

      const { token, appId } = await getToken();
      await client.join(appId, channelName, token, uid);

      if (role === 'host') {
        const [audioTrack, videoTrack] = await createLocalTracks();
        await client.publish([audioTrack, videoTrack]);
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
      }

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

      setJoined(true);
    } catch (err: any) {
      console.error('[Duo] Agora error:', err);
      setError(err?.message ?? 'Erreur de connexion Agora');
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
    if (enabled) join();
    return () => { leave(); };
  }, [enabled]);

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
