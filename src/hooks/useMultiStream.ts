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
import type { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

export interface RemoteStreamUser {
  uid: string | number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  isHost: boolean;
}

interface UseMultiStreamOptions {
  channelName: string;
  uid: number;
  role: 'host' | 'audience';
  enabled: boolean;
}

type ControlAction = 'PROMOTE_TO_HOST' | 'FORCE_MUTE' | 'KICK';

interface ControlPayload {
  action: ControlAction;
  targetUid: number;
  issuedByUid: number;
  ts: number;
}

const MAX_REMOTE_USERS = 4;

async function canOpenMedia(constraints: MediaStreamConstraints): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

function isUidConflict(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as Error & { code?: string }).code ?? '';
  const message = err.message ?? '';
  return (
    code === 'UID_CONFLICT' ||
    message.includes('UID_CONFLICT') ||
    message.includes('UIDConflict')
  );
}

/** Laisse au serveur Agora le temps de libérer l’UID avant un nouveau join. */
function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  if (
    code === 'UID_CONFLICT' ||
    message.includes('UID_CONFLICT') ||
    message.includes('UIDConflict')
  ) {
    return 'Connexion média rétablie.';
  }
  return message || unknownMessage;
}

function isMediaCaptureAllowedInThisContext(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  return window.isSecureContext || isLocalhost;
}

export function useMultiStream({ channelName, uid, role, enabled }: UseMultiStreamOptions) {
  const supabase = createSupabaseClient();
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const remoteAgoraUsersRef = useRef<Map<string | number, IAgoraRTCRemoteUser>>(new Map());
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteStreamUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const controlChannelName = `live-control:${channelName}`;

  const emitControlSignal = useCallback(
    async (payload: Omit<ControlPayload, 'issuedByUid' | 'ts'>) => {
      const ch = supabase.channel(controlChannelName);
      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          ch.subscribe(async (status) => {
            if (settled) return;
            if (status === 'SUBSCRIBED') {
              settled = true;
              const sendResult = await ch.send({
                type: 'broadcast',
                event: 'control',
                payload: {
                  ...payload,
                  issuedByUid: uid,
                  ts: Date.now(),
                } satisfies ControlPayload,
              });
              await supabase.removeChannel(ch);
              if (sendResult !== 'ok') {
                reject(new Error(`Broadcast control signal: ${sendResult}`));
              } else {
                resolve();
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              settled = true;
              reject(new Error(String(status)));
            }
          });
        });
      } catch (e) {
        console.warn('[MultiStream] emitControlSignal', e);
      }
    },
    [controlChannelName, supabase, uid]
  );

  const getToken = useCallback(async () => {
    const res = await fetch('/api/agora/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, uid, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Token API error');
    if (!data?.token || !data?.appId) throw new Error('Agora token response is invalid');
    return { token: data.token as string, appId: data.appId as string };
  }, [channelName, uid, role]);

  const join = useCallback(async () => {
    if (clientRef.current || !enabled) return;

    let client: IAgoraRTCClient | null = null;
    try {
      const insecureHostContext = role === 'host' && !isMediaCaptureAllowedInThisContext();
      if (insecureHostContext) {
        setJoined(false);
        setError(null);
        return;
      }

      client = await createAgoraClient();
      clientRef.current = client;
      remoteAgoraUsersRef.current.clear();

      await client.setClientRole(role === 'host' ? 'host' : 'audience');

      const { token, appId } = await getToken();

      let joinOk = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (attempt > 0) {
            try {
              await client.leave();
            } catch {
              /* noop — rollback après échec */
            }
            await delayMs(280 + attempt * 140);
          }
          await client.join(appId, channelName, token, uid);
          joinOk = true;
          break;
        } catch (joinErr: unknown) {
          if (!isUidConflict(joinErr) || attempt >= 3) {
            console.error('[MultiStream] join error:', joinErr);
            throw joinErr;
          }
          console.warn('[MultiStream] UID_CONFLICT, nouvelle tentative', attempt + 1);
        }
      }

      if (!joinOk || !client) throw new Error('Agora: join incomplet');

      setJoined(true);

      client.on('user-joined', (user: IAgoraRTCRemoteUser) => {
        remoteAgoraUsersRef.current.set(user.uid, user);
      });

      client.on('user-published', async (user, mediaType) => {
        await client!.subscribe(user, mediaType);
        remoteAgoraUsersRef.current.set(user.uid, user);

        setRemoteUsers((prev) => {
          const existing = prev.find((u) => String(u.uid) === String(user.uid));
          if (existing) {
            return prev.map((u) =>
              String(u.uid) === String(user.uid)
                ? {
                    ...u,
                    videoTrack: mediaType === 'video' ? user.videoTrack : u.videoTrack,
                    audioTrack: mediaType === 'audio' ? user.audioTrack : u.audioTrack,
                    isHost: true,
                  }
                : u
            );
          }

          const next = [
            ...prev,
            {
              uid: user.uid,
              videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
              audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
              isHost: true,
            } satisfies RemoteStreamUser,
          ];

          return next.slice(0, MAX_REMOTE_USERS);
        });

        if (mediaType === 'audio') user.audioTrack?.play();
      });

      client.on('user-unpublished', (user, mediaType) => {
        setRemoteUsers((prev) =>
          prev.map((u) =>
            String(u.uid) === String(user.uid)
              ? {
                  ...u,
                  videoTrack: mediaType === 'video' ? undefined : u.videoTrack,
                  audioTrack: mediaType === 'audio' ? undefined : u.audioTrack,
                  isHost: Boolean(
                    (mediaType === 'video' ? undefined : u.videoTrack) ||
                      (mediaType === 'audio' ? undefined : u.audioTrack)
                  ),
                }
              : u
          )
        );
      });

      client.on('user-left', (user) => {
        remoteAgoraUsersRef.current.delete(user.uid);
        setRemoteUsers((prev) => prev.filter((u) => String(u.uid) !== String(user.uid)));
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
              console.warn('[MultiStream] audio track unavailable:', audioErr);
            }
          }

          if (videoAvailable) {
            try {
              videoTrack = await createLocalVideoTrack();
            } catch (videoErr) {
              console.warn('[MultiStream] video track unavailable:', videoErr);
            }
          }

          const tracksToPublish = [audioTrack, videoTrack].filter(Boolean) as (
            | IMicrophoneAudioTrack
            | ICameraVideoTrack
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
          console.error('[MultiStream] device error:', deviceErr);
          setError(getReadableAgoraError(deviceErr));
        }
      }
    } catch (err) {
      console.error('[MultiStream] join error:', err);
      setError(getReadableAgoraError(err));
      try {
        await clientRef.current?.leave();
      } catch {
        /* noop */
      }
      clientRef.current = null;
    }
  }, [channelName, enabled, getToken, role, uid]);

  const leave = useCallback(async () => {
    try {
      localAudioTrack?.close();
      localVideoTrack?.close();
      remoteAgoraUsersRef.current.clear();
      await clientRef.current?.leave();
    } catch (e) {
      console.warn('[MultiStream] leave', e);
    } finally {
      clientRef.current = null;
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setRemoteUsers([]);
      setJoined(false);
    }
  }, [localAudioTrack, localVideoTrack]);

  const joinRef = useRef(join);
  joinRef.current = join;
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  const reconnectEpochRef = useRef(0);

  const tryPublishVideo = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !joined) return;

    if (localVideoTrack) {
      if (camOff) {
        await localVideoTrack.setMuted(false);
        setCamOff(false);
      }
      return;
    }

    try {
      if (!isMediaCaptureAllowedInThisContext()) {
        setError('HTTPS ou localhost requis pour activer la camera.');
        return;
      }
      const videoAvailable = await canOpenMedia({ audio: false, video: true });
      if (!videoAvailable) {
        setError('Camera inaccessible ou permission refusee.');
        return;
      }
      const videoTrack = await createLocalVideoTrack();
      await client.publish([videoTrack]);
      setLocalVideoTrack(videoTrack);
      setCamOff(false);
      setError(null);
    } catch (e) {
      setError(getReadableAgoraError(e));
    }
  }, [joined, localVideoTrack, camOff]);

  /** Crée et publie le micro au premier tap si le live a démarré sans piste audio. */
  const tryPublishAudio = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !joined || role !== 'host') return;

    try {
      if (!isMediaCaptureAllowedInThisContext()) {
        setError('HTTPS ou localhost requis pour activer le micro.');
        return;
      }
      const audioAvailable = await canOpenMedia({ audio: true, video: false });
      if (!audioAvailable) {
        setError('Micro inaccessible ou permission refusee.');
        return;
      }
      const audioTrack = await createLocalAudioTrack();
      await client.publish([audioTrack]);
      setLocalAudioTrack(audioTrack);
      setMicMuted(false);
      setError(null);
    } catch (e) {
      setError(getReadableAgoraError(e));
    }
  }, [joined, role]);

  const toggleMic = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !joined) return;

    if (!localAudioTrack) {
      if (role !== 'host') return;
      await tryPublishAudio();
      return;
    }

    await localAudioTrack.setMuted(!micMuted);
    setMicMuted((m) => !m);
  }, [joined, role, localAudioTrack, micMuted, tryPublishAudio]);

  const toggleCam = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !joined) return;

    if (!localVideoTrack) {
      if (role !== 'host') return;
      await tryPublishVideo();
      return;
    }

    await localVideoTrack.setMuted(!camOff);
    setCamOff((c) => !c);
  }, [joined, role, localVideoTrack, camOff, tryPublishVideo]);

  const muteSelf = useCallback(async () => {
    if (!localAudioTrack) return;
    await localAudioTrack.setMuted(true);
    setMicMuted(true);
  }, [localAudioTrack]);

  const unmuteSelf = useCallback(async () => {
    if (!localAudioTrack) return;
    await localAudioTrack.setMuted(false);
    setMicMuted(false);
  }, [localAudioTrack]);

  const hideCamSelf = useCallback(async () => {
    if (!localVideoTrack) return;
    await localVideoTrack.setMuted(true);
    setCamOff(true);
  }, [localVideoTrack]);

  const showCamSelf = useCallback(async () => {
    if (!localVideoTrack) return;
    await localVideoTrack.setMuted(false);
    setCamOff(false);
  }, [localVideoTrack]);

  const unpublishAll = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !joined) return;
    try {
      await client.unpublish();
      await client.setClientRole('audience');
      try {
        if (localAudioTrack) await localAudioTrack.setMuted(true);
      } catch {
        /* ignore */
      }
      try {
        if (localVideoTrack) await localVideoTrack.setMuted(true);
      } catch {
        /* ignore */
      }
      setMicMuted(true);
      setCamOff(true);
    } catch (e) {
      console.warn('[MultiStream] unpublishAll', e);
    }
  }, [joined, localAudioTrack, localVideoTrack]);

  const promoteToHost = useCallback(
    async (targetUid: number) => {
      const client = clientRef.current;
      if (!client || !joined) return false;

      try {
        if (Number(uid) === Number(targetUid)) {
          await client.setClientRole('host');
          return true;
        }
      } catch (e) {
        console.warn('[MultiStream] promote self to host failed', e);
      }

      await emitControlSignal({ action: 'PROMOTE_TO_HOST', targetUid });
      return true;
    },
    [emitControlSignal, joined, uid]
  );

  const forceMuteRemote = useCallback(
    async (targetUid: number) => {
      const client = clientRef.current;
      if (!client || !joined) return false;

      const forceMuteMethod = (client as unknown as { forceMuteRemoteAudioStream?: (uid: number, mute: boolean) => Promise<void> }).forceMuteRemoteAudioStream;
      if (typeof forceMuteMethod === 'function') {
        try {
          await forceMuteMethod.call(client, targetUid, true);
          return true;
        } catch (e) {
          console.warn('[MultiStream] forceMuteRemoteAudioStream failed', e);
        }
      }

      await emitControlSignal({ action: 'FORCE_MUTE', targetUid });
      return true;
    },
    [emitControlSignal, joined]
  );

  const kickUser = useCallback(
    async (targetUid: number) => {
      const client = clientRef.current;
      if (!client || !joined) return false;

      const kickMethod = (client as unknown as { kickOutOfChannel?: (uid: number) => Promise<void> }).kickOutOfChannel;
      if (typeof kickMethod === 'function') {
        try {
          await kickMethod.call(client, targetUid);
          return true;
        } catch (e) {
          console.warn('[MultiStream] kickOutOfChannel failed', e);
        }
      }

      await emitControlSignal({ action: 'KICK', targetUid });
      return true;
    },
    [emitControlSignal, joined]
  );

  useEffect(() => {
    const ch = supabase.channel(controlChannelName);
    ch.on('broadcast', { event: 'control' }, async (msg) => {
      const payload =
        (msg as { payload?: ControlPayload }).payload ??
        (msg as unknown as ControlPayload);
      if (!payload || payload.targetUid !== uid) return;

      const client = clientRef.current;
      if (!client || !joined) return;

      if (payload.action === 'PROMOTE_TO_HOST') {
        try {
          await client.setClientRole('host');
        } catch (e) {
          console.warn('[MultiStream] control promote failed', e);
        }
        return;
      }

      if (payload.action === 'FORCE_MUTE') {
        try {
          if (localAudioTrack) {
            await localAudioTrack.setMuted(true);
            setMicMuted(true);
          }
        } catch (e) {
          console.warn('[MultiStream] control force mute failed', e);
        }
        return;
      }

      if (payload.action === 'KICK') {
        void leave();
      }
    }).subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [controlChannelName, joined, leave, localAudioTrack, supabase, uid]);

  /** Déconnexion complète puis reconnexion séquentielle : évite UID_CONFLICT quand audience → host. */
  useEffect(() => {
    const epoch = ++reconnectEpochRef.current;
    let cancelled = false;

    async function reconnect() {
      try {
        await leaveRef.current();
      } catch {
        /* noop */
      }
      if (cancelled || epoch !== reconnectEpochRef.current || !enabled) return;
      await delayMs(320);
      if (cancelled || epoch !== reconnectEpochRef.current || !enabled) return;
      await joinRef.current();
    }

    void reconnect();

    return () => {
      cancelled = true;
      void leaveRef.current();
    };
    // join/leave passent par refs (évite dépendances instables sur les pistes locales).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnexion voulue sur role/channel/uid
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
    tryPublishVideo,
    muteSelf,
    unmuteSelf,
    hideCamSelf,
    showCamSelf,
    unpublishAll,
    promoteToHost,
    forceMuteRemote,
    kickUser,
    leave,
  };
}
