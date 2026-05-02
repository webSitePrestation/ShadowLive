'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

interface Props {
  profileId: string;
  sessionId: string;
  onClose: () => void;
}

export default function WalletOverlay({ profileId, sessionId, onClose }: Props) {
  const { transactions, totalReceived } = useWallet(profileId, sessionId);

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 surface-luxury rounded-t-3xl p-6 max-h-[70vh] overflow-hidden flex flex-col"
      style={{ borderTop: '1px solid rgba(184,134,11,0.15)' }}
    >
      {/* Handle */}
      <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-5" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Reçu ce live</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gradient-gold">{totalReceived.toLocaleString()}</span>
            <span className="text-yellow-600/60 text-sm">pièces</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/40 hover:text-white/70"
        >
          <X size={16} />
        </button>
      </div>

      {/* Liste transactions */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
        {transactions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-white/20 text-sm">Aucune pièce reçue pour l'instant</p>
          </div>
        ) : (
          transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * i }}
              className="flex items-center justify-between surface-dark rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🪙</span>
                <div>
                  <p className="text-white/60 text-xs">Don reçu</p>
                  <p className="text-white/25 text-xs">
                    {new Date(tx.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold text-sm">+{tx.amount}</span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
