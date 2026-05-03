'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { generateGradient } from '@/lib/utils/color';
import type { ExploreSessionWithDomina } from '@/types/explore';

interface Props {
  session: ExploreSessionWithDomina;
  index: number;
  onClick: () => void;
  variant?: 'live' | 'pending';
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveCard({ session, index, onClick, variant = 'live' }: Props) {
  const dominaName = session.profiles?.username ?? 'Domina';
  const gradient = generateGradient(dominaName);
  const [durationLabel, setDurationLabel] = useState('0:00');

  useEffect(() => {
    if (variant !== 'live' || !session.started_at) {
      setDurationLabel('—');
      return;
    }
    const start = new Date(session.started_at).getTime();
    const tick = () => {
      setDurationLabel(formatDuration(Date.now() - start));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [variant, session.started_at]);

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative shrink-0 w-[42vw] max-w-[240px] aspect-[9/16] max-h-[min(72vh,420px)] rounded-2xl overflow-hidden text-left border border-white/10 shadow-xl shadow-black/50 snap-center snap-always focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/60"
      style={{ background: gradient }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-[1]">
        <div className="relative shrink-0">
          <Avatar username={dominaName} avatarUrl={session.profiles?.avatar_url} size="lg" />
          {variant === 'live' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-black/80 shadow-[0_0_10px_rgba(239,68,68,0.85)] animate-pulse" />
          )}
        </div>
        {variant === 'live' ? (
          <Badge
            variant="ghost"
            className="shrink-0 flex items-center gap-1 border border-white/15 bg-black/55 text-white/90 text-[10px] px-2 py-1"
          >
            <Users size={11} className="text-white/70" />
            {session.viewer_count}
          </Badge>
        ) : (
          <Badge variant="ghost" className="shrink-0 text-[10px] border border-amber-700/40 bg-black/55 text-amber-200/90">
            Bientôt
          </Badge>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 pt-12 z-[1]">
        {variant === 'live' && (
          <p className="text-[10px] font-mono text-white/70 tabular-nums mb-1">{durationLabel}</p>
        )}
        <p className="text-xs font-bold text-white/90 line-clamp-2 leading-tight mb-0.5">{session.title}</p>
        <p className="text-[11px] text-yellow-500/85 font-medium truncate">{dominaName}</p>
        {variant === 'live' && (
          <p className="text-[9px] text-white/40 mt-0.5 truncate">
            ❤️ {(session.dominaFollowersCount ?? 0).toLocaleString()} abonné
            {(session.dominaFollowersCount ?? 0) !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {variant === 'live' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.07]">
          <span className="text-6xl font-black text-white select-none">LIVE</span>
        </div>
      )}
    </motion.button>
  );
}
