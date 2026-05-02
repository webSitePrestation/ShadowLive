'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Avatar from '@/components/ui/Avatar';
import type { Profile } from '@/types';

interface Props {
  sessionId: string;
  dominaId: string;
  onClose: () => void;
  onInvited: (username: string) => void;
}

export default function DuoInviteModal({ sessionId, dominaId, onClose, onInvited }: Props) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
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
  }, [search]);

  const handleInvite = async (user: Profile) => {
    setInviting(user.id);

    const { data } = await supabase
      .from('access_tokens')
      .insert({
        session_id: sessionId,
        created_by: dominaId,
        role: 'SOUMIS',
      })
      .select()
      .single();

    if (data) {
      const link = `${window.location.origin}/join/${data.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      setInvited(user.id);
      onInvited(user.username);
      setTimeout(() => {
        setInvited(null);
        onClose();
      }, 1500);
    }

    setInviting(null);
  };

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
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-bold">Inviter en Duo</p>
            <p className="text-white/30 text-xs mt-0.5">Le lien sera copié dans le presse-papiers</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
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

        {/* Liste */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/20 text-sm">Aucun soumis trouvé</p>
            </div>
          ) : (
            users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * i }}
                className="flex items-center gap-3 surface-dark rounded-xl px-4 py-3"
              >
                <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.username}</p>
                  <p className="text-white/25 text-xs">{user.coins_balance.toLocaleString()} pièces</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleInvite(user)}
                  disabled={inviting === user.id || invited === user.id}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    invited === user.id
                      ? 'bg-green-700/30 border border-green-600/30'
                      : 'bg-red-800/30 border border-red-700/30 hover:bg-red-800/50'
                  }`}
                >
                  {invited === user.id
                    ? <Check size={15} className="text-green-400" />
                    : <UserPlus size={15} className="text-red-400" />
                  }
                </motion.button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
