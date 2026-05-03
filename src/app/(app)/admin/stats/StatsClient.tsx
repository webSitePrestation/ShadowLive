'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Crown,
  Radio,
  Users,
  Coins,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import type { CoinTransaction, TransactionType } from '@/types';

export interface AdminGlobalStats {
  usersByRole: { ADMIN: number; DOMINA: number; SOUMIS: number };
  liveSessionsNow: number;
  sessionsTotal: number;
  sessionsEnded: number;
  coinsTotalTransacted: number;
  topDominas: {
    id: string;
    username: string;
    avatar_url: string | null;
    coinsReceived: number;
  }[];
}

export type RecentCoinRow = CoinTransaction & {
  sender: Pick<import('@/types').Profile, 'id' | 'username' | 'avatar_url'>;
  receiver: Pick<import('@/types').Profile, 'id' | 'username' | 'avatar_url'>;
};

export type DailyActivity = {
  date: string;
  count: number;
  total: number;
  barPct: number;
};

export type TopSessionRow = {
  id: string;
  title: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  domina_username: string;
  totalCoins: number;
  durationLabel: string;
};

const TX_TABS: (TransactionType | 'ALL')[] = ['ALL', 'GIFT', 'REFUND', 'ADMIN_GRANT'];

interface Props {
  stats: AdminGlobalStats;
  recentTransactions: RecentCoinRow[];
  dailyActivity: DailyActivity[];
  topSessions: TopSessionRow[];
}

function formatTxDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDayLabel(date: string): string {
  const [y, m, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function StatsClient({
  stats,
  recentTransactions,
  dailyActivity,
  topSessions,
}: Props) {
  const router = useRouter();
  const [txTab, setTxTab] = useState<TransactionType | 'ALL'>('ALL');

  const filteredTx = useMemo(() => {
    if (txTab === 'ALL') return recentTransactions;
    return recentTransactions.filter((t) => t.type === txTab);
  }, [recentTransactions, txTab]);

  const cards = [
    {
      label: 'Utilisateurs',
      value: stats.usersByRole.ADMIN + stats.usersByRole.DOMINA + stats.usersByRole.SOUMIS,
      sub: `${stats.usersByRole.DOMINA} Dom · ${stats.usersByRole.SOUMIS} Sou`,
      icon: <Users size={18} className="text-yellow-600/70" />,
    },
    {
      label: 'Lives en direct',
      value: stats.liveSessionsNow,
      sub: 'sessions LIVE',
      icon: <Radio size={18} className="text-red-500/80" />,
    },
    {
      label: 'Sessions totales',
      value: stats.sessionsTotal,
      sub: `${stats.sessionsEnded} terminées`,
      icon: <BarChart3 size={18} className="text-white/40" />,
    },
    {
      label: 'Pièces transactées',
      value: stats.coinsTotalTransacted.toLocaleString(),
      sub: 'sum coin_transactions',
      icon: <Coins size={18} className="text-yellow-500/80" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#080808] pb-10">
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="text-white/30 hover:text-white/70 transition-colors"
              aria-label="Retour admin"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase text-gradient-gold">
                Stats globales
              </h1>
              <p className="text-[10px] text-white/25 tracking-wider">ShadowLive</p>
            </div>
          </div>
          <Badge variant="gold" className="gap-1">
            <BarChart3 size={10} />
            Admin
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="surface-luxury rounded-2xl p-4 border border-yellow-900/15"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-white/35 text-[10px] uppercase tracking-widest leading-tight">
                  {c.label}
                </span>
                {c.icon}
              </div>
              <p className="text-2xl font-black text-gradient-gold leading-none tabular-nums">{c.value}</p>
              <p className="text-white/25 text-[10px] mt-2">{c.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="surface-luxury rounded-2xl p-5 border border-yellow-900/15"
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-yellow-600/80" />
            <p className="text-white/50 text-xs uppercase tracking-widest">Top Dominas · pièces reçues</p>
          </div>
          <div className="space-y-3">
            {stats.topDominas.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-6">Aucune donnée de transactions.</p>
            ) : (
              stats.topDominas.map((d, rank) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 surface-dark rounded-xl px-3 py-2.5 border border-white/5"
                >
                  <span className="text-yellow-700/50 text-xs font-black w-5 tabular-nums">#{rank + 1}</span>
                  <Avatar username={d.username} avatarUrl={d.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                      <Crown size={11} className="text-yellow-600/50 shrink-0" />
                      {d.username}
                    </p>
                  </div>
                  <span className="text-yellow-500 text-sm font-bold tabular-nums shrink-0">
                    {d.coinsReceived.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Transactions récentes */}
        <section className="surface-luxury rounded-2xl p-5 border border-yellow-900/15">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-white/50 text-xs uppercase tracking-widest">Transactions récentes</p>
            <span className="text-white/25 text-[10px] tabular-nums">{filteredTx.length}</span>
          </div>
          <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
            {TX_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTxTab(tab)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                  txTab === tab
                    ? 'bg-yellow-900/40 border-yellow-600/50 text-yellow-200'
                    : 'bg-white/5 border-white/10 text-white/45 hover:text-white/70'
                }`}
              >
                {tab === 'ALL' ? 'Tous' : tab}
              </button>
            ))}
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto scrollbar-hide space-y-2 pr-1">
            {filteredTx.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">Aucune transaction.</p>
            ) : (
              filteredTx.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 surface-dark rounded-xl px-2.5 py-2 border border-white/5"
                >
                  <Avatar username={t.sender.username} avatarUrl={t.sender.avatar_url} size="sm" />
                  <ArrowRight size={12} className="text-white/20 shrink-0" />
                  <Avatar username={t.receiver.username} avatarUrl={t.receiver.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-yellow-500 text-xs font-bold tabular-nums">+{t.amount.toLocaleString()}</p>
                    <p className="text-white/30 text-[9px]">{formatTxDate(t.created_at)}</p>
                  </div>
                  <Badge variant="ghost" className="text-[8px] shrink-0 px-1.5 py-0">
                    {t.type}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Top sessions */}
        <section className="surface-luxury rounded-2xl p-5 border border-yellow-900/15">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={16} className="text-yellow-600/80" />
            <p className="text-white/50 text-xs uppercase tracking-widest">Top sessions · pièces</p>
          </div>
          {topSessions.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-6">Pas encore de transactions liées à une session.</p>
          ) : (
            <div className="space-y-2">
              {topSessions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => router.push(`/session/${s.id}`)}
                  className="w-full text-left surface-dark rounded-xl p-3 border border-white/8 hover:border-yellow-700/35 transition-colors active-scale"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-yellow-700/50 text-xs font-black tabular-nums">#{i + 1}</span>
                    <span className="text-yellow-500 text-sm font-bold tabular-nums shrink-0">
                      {s.totalCoins.toLocaleString()} 🪙
                    </span>
                  </div>
                  <p className="text-white text-sm font-semibold truncate mt-1">{s.title}</p>
                  <p className="text-white/40 text-[11px] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="text-yellow-600/70">{s.domina_username}</span>
                    <span>·</span>
                    <span>{s.durationLabel}</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Activité par jour */}
        <section className="surface-luxury rounded-2xl p-5 border border-yellow-900/15">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Activité par jour (7 jours)</p>
          <div className="space-y-3">
            {dailyActivity.map((d) => (
              <div key={d.date} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">{formatDayLabel(d.date)}</span>
                  <span className="text-white/35 tabular-nums">
                    {d.count} tx · <span className="text-yellow-600/80">{d.total.toLocaleString()} 🪙</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-900/80 to-amber-500/70 transition-[width] duration-500"
                    style={{ width: `${d.barPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
