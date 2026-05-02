'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Link2, Video, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { accessTokenExpiresAtIso } from '@/lib/access-token';
import Avatar from '@/components/ui/Avatar';
import type { Profile } from '@/types';

interface Props {
  sessionId: string;
  sessionTitle: string;
  dominaDisplayName: string;
  dominaId: string;
  /** Profils présents sur la page du live (Presence) — pour afficher « Inviter en Duo » */
  soumisIdsInLive: string[];
  sendDuoRequest: (soumisId: string) => Promise<{ error?: string }>;
  onClose: () => void;
  onInvited: (username: string, mode: 'link' | 'duo', link?: string) => void;
}

export default function DuoInviteModal({
  sessionId,
  sessionTitle,
  dominaDisplayName,
  dominaId,
  soumisIdsInLive,
  sendDuoRequest,
  onClose,
  onInvited,
}: Props) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'link' | 'duo' | null>(null);
  const [doneUserId, setDoneUserId] = useState<string | null>(null);
  const [doneMode, setDoneMode] = useState<'link' | 'duo' | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchUsers = async () => {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'SOUMIS')
        .neq('id', dominaId)
        .limit(20);

      if (search.trim()) {
        query.ilike('username', `%${search}%`);
      }

      const { data } = await query;
      setUsers(data ?? []);
    };

    fetchUsers();
  }, [search, dominaId]);

  const handleInviteByLink = async (user: Profile) => {
    setBusyUserId(user.id);
    setBusyMode('link');

    const { data } = await supabase
      .from('access_tokens')
      .insert({
        session_id: sessionId,
        created_by: dominaId,
        role: 'SOUMIS',
        expires_at: accessTokenExpiresAtIso(),
      })
      .select()
      .single();

    if (!data) {
      alert('Impossible de créer le lien d’invitation.');
      setBusyUserId(null);
      setBusyMode(null);
      return;
    }

    const link = `${window.location.origin}/join/${encodeURIComponent(data.token)}`;
    await navigator.clipboard.writeText(link).catch(() => {});

    const notifyCh = supabase.channel(`invite-notify:${user.id}`);
    notifyCh.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await notifyCh.send({
          type: 'broadcast',
          event: 'duo_invite',
          payload: {
            token: data.token,
            sessionId,
            sessionTitle,
            dominaName: dominaDisplayName,
          },
        });
        await supabase.removeChannel(notifyCh);
      }
    });

    setDoneUserId(user.id);
    setDoneMode('link');
    onInvited(user.username, 'link', link);
    setTimeout(() => {
      setDoneUserId(null);
      setDoneMode(null);
      onClose();
    }, 1500);

    setBusyUserId(null);
    setBusyMode(null);
  };

  const handleInviteDuoLive = async (user: Profile) => {
    setBusyUserId(user.id);
    setBusyMode('duo');
    const { error } = await sendDuoRequest(user.id);
    if (error) {
      alert(error);
      setBusyUserId(null);
      setBusyMode(null);
      return;
    }
    setDoneUserId(user.id);
    setDoneMode('duo');
    onInvited(user.username, 'duo');
    setTimeout(() => {
      setDoneUserId(null);
      setDoneMode(null);
      onClose();
    }, 1200);
    setBusyUserId(null);
    setBusyMode(null);
  };

  const inLive = (userId: string) => soumisIdsInLive.includes(userId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full surface-luxury rounded-t-3xl p-5 max-h-[75vh] flex flex-col"
        style={{ borderTop: '1px solid rgba(184,134,11,0.15)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-bold">Inviter en Duo</p>
            <p className="text-white/30 text-xs mt-0.5">
              Lien (hors live) · Notification instantanée si le soumis est déjà sur ce live
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            placeholder="Rechercher un soumis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-black/50 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-700/30 transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/20 text-sm">Aucun soumis trouvé</p>
            </div>
          ) : (
            users.map((user, i) => {
              const onLive = inLive(user.id);
              const busy = busyUserId === user.id;
              const done = doneUserId === user.id;
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                  className="flex items-center gap-2 surface-dark rounded-xl px-3 py-3"
                >
                  <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user.username}</p>
                    <p className="text-white/25 text-xs">
                      {user.coins_balance.toLocaleString()} pièces
                      {onLive && (
                        <span className="text-yellow-600/70 ml-2">· Sur ce live</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                      type="button"
                      title="Inviter par lien"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleInviteByLink(user)}
                      disabled={busy || (done && doneMode !== 'link')}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
                        done && doneMode === 'link'
                          ? 'bg-green-700/30 border-green-600/30'
                          : 'bg-white/6 border-white/10 hover:bg-white/10'
                      } disabled:opacity-40`}
                    >
                      {busy && busyMode === 'link' ? (
                        <span className="text-[10px] text-white/50">…</span>
                      ) : done && doneMode === 'link' ? (
                        <Check size={15} className="text-green-400" />
                      ) : (
                        <Link2 size={15} className="text-yellow-500/80" />
                      )}
                    </motion.button>
                    {onLive && (
                      <motion.button
                        type="button"
                        title="Inviter en Duo (notification)"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleInviteDuoLive(user)}
                        disabled={busy || (done && doneMode !== 'duo')}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${
                          done && doneMode === 'duo'
                            ? 'bg-green-700/30 border-green-600/30'
                            : 'bg-red-800/30 border-red-700/30 hover:bg-red-800/50'
                        } disabled:opacity-40`}
                      >
                        {busy && busyMode === 'duo' ? (
                          <span className="text-[10px] text-white/50">…</span>
                        ) : done && doneMode === 'duo' ? (
                          <Check size={15} className="text-green-400" />
                        ) : (
                          <Video size={15} className="text-red-400" />
                        )}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
