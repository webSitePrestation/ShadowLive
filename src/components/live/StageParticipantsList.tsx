'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import type { StageParticipant } from '@/types';

interface Props {
  participants: StageParticipant[];
  isDomina: boolean;
  /** Ne jamais proposer « Descendre » pour le profil Domina (sécurité si une ligne parasite existe en base). */
  dominaProfileId: string;
  onRemove?: (profileId: string) => void;
}

export default function StageParticipantsList({
  participants,
  isDomina,
  dominaProfileId,
  onRemove,
}: Props) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const active = participants.filter(
    (p) => p.is_on_stage && p.profile_id !== dominaProfileId
  );

  if (active.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide pb-1">
        {active.map((p) => {
          const name = p.profile?.username ?? 'Intervenant';
          const camOn = !p.cam_off;
          return (
            <div key={p.id} className="relative flex w-[92px] shrink-0 flex-col items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!isDomina) return;
                  setOpenMenuFor((cur) => (cur === p.profile_id ? null : p.profile_id));
                }}
                className="flex w-full flex-col items-center gap-1"
              >
                <div className="relative">
                  <Avatar username={name} avatarUrl={p.profile?.avatar_url} size="md" />
                  <span
                    className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border border-black ${
                      camOn ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                </div>
                <span className="max-w-full truncate text-center text-[11px] text-white/70">{name}</span>
              </button>

              {isDomina && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(p.profile_id);
                  }}
                  className="flex w-full touch-manipulation items-center justify-center gap-1 rounded-lg border border-amber-600/45 bg-amber-900/35 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-900/50"
                  aria-label={`Descendre ${name} de la scène`}
                >
                  <ArrowDown size={12} /> Descendre
                </button>
              )}

              <AnimatePresence>
                {isDomina && openMenuFor === p.profile_id && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    className="absolute z-40 top-[108%] left-1/2 min-w-[118px] -translate-x-1/2 rounded-xl border border-white/15 bg-black/95 p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.(p.profile_id);
                        setOpenMenuFor(null);
                      }}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-700/35 bg-amber-900/20 text-xs text-amber-200"
                    >
                      <ArrowDown size={12} />
                      Descendre
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
