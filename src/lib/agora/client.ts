'use client';

import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng';

export type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack, IRemoteAudioTrack };

let agoraModulePromise: Promise<typeof import('agora-rtc-sdk-ng').default> | null = null;

async function getAgoraRTC() {
  if (typeof window === 'undefined') {
    throw new Error('Agora RTC is only available in the browser');
  }
  if (!agoraModulePromise) {
    agoraModulePromise = import('agora-rtc-sdk-ng').then((mod) => mod.default);
  }
  return agoraModulePromise;
}

export async function createAgoraClient(): Promise<IAgoraRTCClient> {
  const AgoraRTC = await getAgoraRTC();
  return AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
}

export async function createLocalTracks(): Promise<[IMicrophoneAudioTrack, ICameraVideoTrack]> {
  const AgoraRTC = await getAgoraRTC();
  return AgoraRTC.createMicrophoneAndCameraTracks(
    { encoderConfig: 'music_standard' },
    { encoderConfig: '720p_2' }
  );
}

export async function createLocalTracksFromAvailableDevices(
  hasMic: boolean,
  hasCam: boolean
): Promise<{ audioTrack: IMicrophoneAudioTrack | null; videoTrack: ICameraVideoTrack | null }> {
  const AgoraRTC = await getAgoraRTC();
  let audioTrack: IMicrophoneAudioTrack | null = null;
  let videoTrack: ICameraVideoTrack | null = null;

  if (hasMic) {
    audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'music_standard' });
  }
  if (hasCam) {
    videoTrack = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p_2' });
  }

  return { audioTrack, videoTrack };
}

export async function createLocalAudioTrack(): Promise<IMicrophoneAudioTrack> {
  const AgoraRTC = await getAgoraRTC();
  return AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'music_standard' });
}

export async function createLocalVideoTrack(): Promise<ICameraVideoTrack> {
  const AgoraRTC = await getAgoraRTC();
  return AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p_2' });
}
