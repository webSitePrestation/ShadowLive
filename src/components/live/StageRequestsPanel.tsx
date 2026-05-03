'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import type { StageRequest, UserRole } from '@/types';

interface Props {
  requests: StageRequest[];
  onAccept: (requestId: string, requesterId: string) => void;
  onDecline: (requestId: string) => void;
}

function roleVariant(role: UserRole): 'gold' | 'red' | 'ghost' {
  if (role === 'ADMIN') return 'gold';
  if (role === 'DOMINA') return 'red';
  return 'ghost';
}

function timeAgo(iso: string) {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  return `il y a ${h}h`;
}

export default function StageRequestsPanel({ requests, onAccept, onDecline }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pending = useMemo(() => requests.filter((r) => r.status === 'PENDING'), [requests]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pending.length === 0) return null;

  const sheet = mounted ? (
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="stage-requests-backdrop"
              role="presentation"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100000] isolate bg-black/60 pointer-events-auto"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            />
            <motion.div
              key="stage-requests-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed inset-x-0 bottom-0 z-[100001] mx-auto isolate w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#0b0b0b] pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl pointer-events-auto touch-manipulation"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white/90">Demandes de scène ({pending.length})</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 touch-manipulation"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain p-3 touch-manipulation [-webkit-overflow-scrolling:touch]">
                {pending.map((req) => {
                  const name = req.requester?.username ?? 'Intervenant';
                  const role = req.requester?.role ?? 'SOUMIS';
                  return (
                    <div key={req.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-3">
                        <Avatar username={name} avatarUrl={req.requester?.avatar_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm text-white/85">{name}</p>
                            <Badge variant={roleVariant(role)}>{role}</Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-white/40">{timeAgo(req.created_at)}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            onAccept(req.id, req.requester_id);
                            setOpen(false);
                          }}
                          className="h-10 rounded-lg border border-emerald-600/45 bg-emerald-900/25 text-emerald-200 text-xs font-semibold touch-manipulation"
                        >
                          ✅ Accepter
                        </button>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            onDecline(req.id);
                            setOpen(false);
                          }}
                          className="h-10 rounded-lg border border-red-700/45 bg-red-900/20 text-red-200 text-xs font-semibold touch-manipulation"
                        >
                          ❌ Refuser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )
  ) : null;

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="relative flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 backdrop-blur-sm"
        aria-label="Ouvrir les demandes de scène"
      >
        <Users size={16} />
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-red-400/60 bg-red-600 px-1 text-[10px] font-bold text-white">
          {pending.length}
        </span>
      </motion.button>
      {sheet}
    </>
  );
}
