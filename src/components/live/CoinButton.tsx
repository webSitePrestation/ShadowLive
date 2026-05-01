'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  amount: number;
  onSend: (amount: number) => Promise<boolean>;
  disabled?: boolean;
}

export default function CoinButton({ amount, onSend, disabled }: Props) {
  const [pressing, setPressing] = useState(false);

  const handlePress = async () => {
    if (disabled || pressing) return;
    setPressing(true);

    if (navigator.vibrate) navigator.vibrate(30);

    await onSend(amount);
    setTimeout(() => setPressing(false), 300);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={handlePress}
      disabled={disabled || pressing}
      className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 active:bg-yellow-500/30 transition-all disabled:opacity-30"
    >
      <span className="text-xl">🪙</span>
      <span className="text-yellow-400 text-xs font-bold mt-0.5">{amount}</span>
    </motion.button>
  );
}
