'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Crown, Shield, ChevronDown, Check, ArrowLeft, Coins, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { Profile, UserRole } from '@/types';

interface Props {
  currentAdmin: Profile;
  users: Profile[];
}

const ROLES: UserRole[] = ['ADMIN', 'DOMINA', 'SOUMIS'];

const roleConfig = {
  ADMIN: { label: 'Admin', icon: '👑', variant: 'gold' as const },
  DOMINA: { label: 'Domina', icon: '⛓️', variant: 'red' as const },
  SOUMIS: { label: 'Soumis', icon: '🖤', variant: 'ghost' as const },
};

export default function AdminClient({ currentAdmin, users }: Props) {
  const [userList, setUserList] = useState<Profile[]>(users);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coinsInput, setCoinsInput] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const showFeedback = (id: string, msg: string) => {
    setFeedback(f => ({ ...f, [id]: msg }));
    setTimeout(() => setFeedback(f => ({ ...f, [id]: '' })), 2500);
  };

  const updateRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentAdmin.id) return;
    setLoadingId(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      setUserList(list =>
        list.map(u => u.id === userId ? { ...u, role: newRole } : u)
      );
      showFeedback(userId, `Rôle mis à jour : ${newRole}`);
    }
    setLoadingId(null);
  };

  const grantCoins = async (userId: string) => {
    const amount = parseInt(coinsInput[userId] ?? '0');
    if (!amount || amount <= 0) return;
    setLoadingId(userId);

    const user = userList.find(u => u.id === userId);
    if (!user) return;

    const newBalance = user.coins_balance + amount;

    const { error } = await supabase
      .from('profiles')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (!error) {
      setUserList(list =>
        list.map(u => u.id === userId ? { ...u, coins_balance: newBalance } : u)
      );
      setCoinsInput(c => ({ ...c, [userId]: '' }));
      showFeedback(userId, `+${amount} pièces attribuées`);
    }
    setLoadingId(null);
  };

  const stats = {
    total: userList.length,
    admins: userList.filter(u => u.role === 'ADMIN').length,
    dominas: userList.filter(u => u.role === 'DOMINA').length,
    soumis: userList.filter(u => u.role === 'SOUMIS').length,
  };

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-white/30 hover:text-white/70 transition-colors shrink-0"
              aria-label="Retour dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/stats')}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-yellow-900/15 border border-yellow-700/25 text-yellow-600/90 hover:text-yellow-500 hover:border-yellow-600/40 transition-colors text-[9px] font-bold uppercase tracking-wide max-w-[7.5rem] leading-tight text-left"
            >
              <BarChart3 size={14} className="shrink-0" />
              Voir les stats globales
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-widest text-white/80 uppercase truncate">Panel Admin</h1>
              <p className="text-xs text-yellow-600/60 tracking-wider truncate">ShadowLive</p>
            </div>
          </div>
          <Badge variant="gold" className="shrink-0">
            <Crown size={10} />
            {currentAdmin.username}
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-4 gap-2"
        >
          {[
            { label: 'Total', value: stats.total, icon: <Users size={14} /> },
            { label: 'Admins', value: stats.admins, icon: '👑' },
            { label: 'Dominas', value: stats.dominas, icon: '⛓️' },
            { label: 'Soumis', value: stats.soumis, icon: '🖤' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="surface-luxury rounded-xl p-3 text-center"
            >
              <div className="text-lg mb-1">{stat.icon}</div>
              <div className="text-white font-bold text-lg leading-none">{stat.value}</div>
              <div className="text-white/30 text-xs mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Liste utilisateurs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-white/20 text-xs uppercase tracking-widest mb-3 px-1">
            Utilisateurs ({userList.length})
          </p>
          <div className="space-y-2">
            {userList.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="surface-dark rounded-xl overflow-hidden"
              >
                {/* User row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer active-scale"
                  onClick={() => setExpandedId(id => id === user.id ? null : user.id)}
                >
                  <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{user.username}</p>
                      {user.id === currentAdmin.id && (
                        <span className="text-yellow-600/60 text-xs">(toi)</span>
                      )}
                    </div>
                    <p className="text-white/25 text-xs">
                      {user.coins_balance.toLocaleString()} pièces
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={roleConfig[user.role].variant}>
                      {roleConfig[user.role].icon} {user.role}
                    </Badge>
                    <ChevronDown
                      size={14}
                      className={`text-white/20 transition-transform ${expandedId === user.id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Panel expandé */}
                <AnimatePresence>
                  {expandedId === user.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="p-4 space-y-4">
                        {/* Changer le rôle */}
                        {user.id !== currentAdmin.id && (
                          <div>
                            <p className="text-white/30 text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
                              <Shield size={10} />
                              Changer le rôle
                            </p>
                            <div className="flex gap-2">
                              {ROLES.map(role => (
                                <button
                                  key={role}
                                  onClick={() => updateRole(user.id, role)}
                                  disabled={loadingId === user.id || user.role === role}
                                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                                    user.role === role
                                      ? 'bg-red-800/30 border border-red-700/30 text-red-400'
                                      : 'bg-white/5 border border-white/8 text-white/50 hover:text-white/80 hover:border-white/20'
                                  }`}
                                >
                                  {user.role === role && <Check size={10} />}
                                  {roleConfig[role].icon} {role}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Attribuer des pièces */}
                        <div>
                          <p className="text-white/30 text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
                            🪙 Attribuer des pièces
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Montant..."
                              value={coinsInput[user.id] ?? ''}
                              onChange={e => setCoinsInput(c => ({ ...c, [user.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && grantCoins(user.id)}
                              className="flex-1 bg-black/50 border border-white/8 rounded-lg px-3 py-2 text-white text-sm placeholder-white/15 focus:outline-none focus:border-yellow-700/40 transition-colors"
                            />
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={() => grantCoins(user.id)}
                              disabled={loadingId === user.id || !coinsInput[user.id]}
                            >
                              Attribuer
                            </Button>
                          </div>
                        </div>

                        {/* Feedback */}
                        <AnimatePresence>
                          {feedback[user.id] && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="text-green-400/80 text-xs text-center"
                            >
                              ✓ {feedback[user.id]}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
