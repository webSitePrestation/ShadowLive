'use client';

import { useEffect, useRef } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from '@/lib/agora/client';

interface Props {
  track: ICameraVideoTrack | IRemoteVideoTrack | null | undefined;
  className?: string;
  muted?: boolean;
  mirror?: boolean;
}

export default function VideoStage({ track, className = '', muted = false, mirror = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTrackRef = useRef<ICameraVideoTrack | IRemoteVideoTrack | null>(null);

  useEffect(() => {
    if (!containerRef.current || !track) return;

    if (currentTrackRef.current === track) return;

    currentTrackRef.current?.stop();
    currentTrackRef.current = track;

    let cancelled = false;
    Promise.resolve(track.play(containerRef.current)).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      const isInterruptedPlay =
        message.includes('interrupted by a new load request') || message.includes('AbortError');
      if (!cancelled && !isInterruptedPlay) {
        console.error('VideoStage play error:', err);
      }
    });

    return () => {
      cancelled = true;
      if (currentTrackRef.current === track) {
        track.stop();
        currentTrackRef.current = null;
      }
    };
  }, [track]);

  return (
    <div
      ref={containerRef}
      className={`bg-black overflow-hidden ${mirror ? '[transform:scaleX(-1)]' : ''} ${className}`}
    />
  );
}
