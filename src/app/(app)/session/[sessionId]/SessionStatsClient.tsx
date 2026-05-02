'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, MessageCircle, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { LiveSession, Profile, CoinTransaction } from '@/types';

interface Props {
  session: LiveSession;
  profile: Profile;
  transactions: CoinTransaction[];
  messageCount: number;
}

function getDuration(start: string | null, end: string | null): string {
  if (!start || !end) return 'N/A';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export default function SessionStatsClient({ session, profile, transactions, messageCount }: Props) {
  const router = useRouter();
  const totalCoins = transactions.reduce((sum, t) => sum + t.amount, 0);
  const uniqueSenders = new Set(transactions.map(t => t.sender_id)).size;
  const duration = getDuration(session.started_at, session.ended_at);

  const stats = [
    { label: 'Pièces reçues', value: totalCoins.toLocaleString(), icon: '🪙', color: 'text-gradient-gold' },
    { label: 'Donateurs', value: uniqueSenders, icon: '👥', color: 'text-white' },
    { label: 'Messages', value: messageCount, icon: '💬', color: 'text-white' },
    { label: 'Durée', value: duration, icon: '⏱️', color: 'text-white' },
    { label: 'Pic viewers', value: session.viewer_count, icon: '👁️', color: 'text-white' },
    { label: 'Dons', value: transactions.length, icon: '🎁', color: 'text-white' },
  ];

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-white/70 uppercase">Récap du Live</h1>
            <p className="text-xs text-white/25 truncate max-w-48">{session.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              className="surface-luxury rounded-2xl p-4"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-white/25 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Timeline des dons */}
        {transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-white/20 text-xs uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
              <TrendingUp size={10} />
              Timeline des dons
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-hide">
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.02 * i }}
                  className="surface-dark rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🪙</span>
                    <p className="text-white/30 text-xs">
                      {new Date(tx.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-yellow-400 font-bold text-sm">+{tx.amount}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
