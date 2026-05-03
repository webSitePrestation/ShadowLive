'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, Check, ArrowLeft, Coins, BarChart3, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { Profile, UserRole } from '@/types';

export type UserWithAdminStats = Profile & {
  sessionsCreated: number;
  coinsSent: number;
  coinsReceived: number;
};

interface Props {
  currentAdmin: Profile;
  users: UserWithAdminStats[];
  totalCount: number;
  page: number;
  pageSize: number;
  roleFilter: UserRole | 'ALL';
  searchQ: string;
}

const ROLES: UserRole[] = ['ADMIN', 'DOMINA', 'SOUMIS'];
const ROLE_TABS: (UserRole | 'ALL')[] = ['ALL', 'ADMIN', 'DOMINA', 'SOUMIS'];

const roleConfig = {
  ADMIN: { label: 'Admin', icon: '👑', variant: 'gold' as const },
  DOMINA: { label: 'Domina', icon: '⛓️', variant: 'red' as const },
  SOUMIS: { label: 'Soumis', icon: '🖤', variant: 'ghost' as const },
};

function buildQuery(base: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(base).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export default function UsersClient({
  currentAdmin,
  users,
  totalCount,
  page,
  pageSize,
  roleFilter,
  searchQ,
}: Props) {
  const [userList, setUserList] = useState(users);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coinsInput, setCoinsInput] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [localSearch, setLocalSearch] = useState(searchQ);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const showFeedback = (id: string, msg: string) => {
    setFeedback((f) => ({ ...f, [id]: msg }));
    setTimeout(() => setFeedback((f) => ({ ...f, [id]: '' })), 2500);
  };

  const updateRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentAdmin.id) return;
    setLoadingId(userId);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) {
      setUserList((list) => list.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      showFeedback(userId, `Rôle mis à jour : ${newRole}`);
    }
    setLoadingId(null);
  };

  const grantCoins = async (userId: string) => {
    const amount = parseInt(coinsInput[userId] ?? '0', 10);
    if (!amount || amount <= 0) return;
    setLoadingId(userId);
    const user = userList.find((u) => u.id === userId);
    if (!user) return;
    const newBalance = user.coins_balance + amount;
    const { error } = await supabase.from('profiles').update({ coins_balance: newBalance }).eq('id', userId);
    if (!error) {
      setUserList((list) =>
        list.map((u) =>
          u.id === userId
            ? { ...u, coins_balance: newBalance, coinsReceived: u.coinsReceived + amount }
            : u
        )
      );
      setCoinsInput((c) => ({ ...c, [userId]: '' }));
      showFeedback(userId, `+${amount} pièces attribuées`);
    }
    setLoadingId(null);
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/admin/users${buildQuery({
        page: '1',
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        q: localSearch.trim() || undefined,
      })}`
    );
  };

  const tabHref = (role: UserRole | 'ALL') =>
    `/admin/users${buildQuery({
      page: '1',
      role: role === 'ALL' ? undefined : role,
      q: searchQ || undefined,
    })}`;

  const pageHref = (p: number) =>
    `/admin/users${buildQuery({
      page: String(p),
      role: roleFilter === 'ALL' ? undefined : roleFilter,
      q: searchQ || undefined,
    })}`;

  return (
    <div className="min-h-screen bg-[#080808] pb-10">
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="text-white/30 hover:text-white/70 transition-colors shrink-0"
                aria-label="Retour admin"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-widest text-white/80 uppercase truncate">
                  Utilisateurs
                </h1>
                <p className="text-xs text-yellow-600/60 tracking-wider">{totalCount} comptes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/admin/stats')}
              className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-yellow-900/15 border border-yellow-700/25 text-yellow-600/90 text-[9px] font-bold uppercase"
            >
              <BarChart3 size={12} />
              Stats
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {ROLE_TABS.map((r) => (
              <Link
                key={r}
                href={tabHref(r)}
                scroll={false}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                  roleFilter === r
                    ? 'bg-yellow-900/40 border-yellow-600/50 text-yellow-100'
                    : 'bg-white/5 border-white/10 text-white/45 hover:text-white/75'
                }`}
              >
                {r === 'ALL' ? 'Tous' : r}
              </Link>
            ))}
          </div>
          <form onSubmit={applySearch} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                name="q"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Rechercher un pseudo…"
                className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-yellow-700/40"
              />
            </div>
            <Button type="submit" variant="gold" size="sm" className="shrink-0">
              OK
            </Button>
          </form>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {userList.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-12">Aucun utilisateur pour ces filtres.</p>
        ) : (
          userList.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.02 * i }}
              className="surface-dark rounded-xl overflow-hidden border border-white/6"
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer active-scale"
                onClick={() => setExpandedId((id) => (id === user.id ? null : user.id))}
              >
                <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">{user.username}</p>
                    {user.id === currentAdmin.id && (
                      <span className="text-yellow-600/60 text-xs shrink-0">(toi)</span>
                    )}
                  </div>
                  <p className="text-white/35 text-[10px] mt-0.5">
                    {user.sessionsCreated} session{user.sessionsCreated !== 1 ? 's' : ''} · envoyé{' '}
                    {user.coinsSent.toLocaleString()} · reçu {user.coinsReceived.toLocaleString()} 🪙 · solde{' '}
                    {user.coins_balance.toLocaleString()}
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
                      {user.id !== currentAdmin.id && (
                        <div>
                          <p className="text-white/30 text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Shield size={10} />
                            Changer le rôle
                          </p>
                          <div className="flex gap-2">
                            {ROLES.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => void updateRole(user.id, role)}
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

                      <div>
                        <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Attribuer des pièces</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Montant…"
                            value={coinsInput[user.id] ?? ''}
                            onChange={(e) => setCoinsInput((c) => ({ ...c, [user.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && void grantCoins(user.id)}
                            className="flex-1 bg-black/50 border border-white/8 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-yellow-700/40"
                          />
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => void grantCoins(user.id)}
                            disabled={loadingId === user.id || !coinsInput[user.id]}
                          >
                            Attribuer
                          </Button>
                        </div>
                      </div>

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
          ))
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="text-sm text-yellow-600/90 hover:text-yellow-500"
                scroll={false}
              >
                ← Précédent
              </Link>
            ) : (
              <span className="text-sm text-white/15">← Précédent</span>
            )}
            <span className="text-white/40 text-xs tabular-nums">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="text-sm text-yellow-600/90 hover:text-yellow-500"
                scroll={false}
              >
                Suivant →
              </Link>
            ) : (
              <span className="text-sm text-white/15">Suivant →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
