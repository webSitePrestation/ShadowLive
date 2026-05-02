'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  amount: number;
  onSend: (amount: number) => Promise<boolean>;
  disabled?: boolean;
}

export default function CoinButton({ amount, onSend, disabled }: Props) {
  const [pressing, setPressing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handlePress = async () => {
    if (disabled || pressing) return;
    setPressing(true);
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);

    const success = await onSend(amount);

    if (success) {
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 600);
    }
    setTimeout(() => setPressing(false), 300);
  };

  return (
    <div className="relative flex flex-col items-center">
      <AnimatePresence>
        {showFeedback && (
          <motion.span
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute -top-6 text-yellow-400 text-xs font-bold pointer-events-none"
          >
            +{amount}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.82 }}
        onClick={handlePress}
        disabled={disabled || pressing}
        className={`flex flex-col items-center justify-center w-15 h-15 rounded-2xl transition-all
          ${disabled
            ? 'bg-white/3 border border-white/5 opacity-30'
            : pressing
            ? 'bg-yellow-500/25 border border-yellow-500/50 glow-gold'
            : 'bg-yellow-900/20 border border-yellow-700/25 hover:bg-yellow-900/30 active:bg-yellow-500/20'
          }`}
        style={{ width: 56, height: 56 }}
      >
        <span className="text-lg leading-none">🪙</span>
        <span className="text-yellow-400 text-xs font-bold mt-0.5 leading-none">{amount}</span>
      </motion.button>
    </div>
  );
}
