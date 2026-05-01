'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Coin {
  id: number;
  x: number;
  amount: number;
}

interface Props {
  trigger: number;
  amount: number;
}

export default function CoinRain({ trigger, amount }: Props) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (trigger === 0) return;
    const newCoins: Coin[] = Array.from({ length: Math.min(amount, 12) }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10,
      amount,
    }));
    setCoins(prev => [...prev, ...newCoins]);
    setCounter(c => c + amount);
    setTimeout(() => setCoins([]), 2000);
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {coins.map(coin => (
          <motion.div
            key={coin.id}
            initial={{ y: -20, x: `${coin.x}vw`, opacity: 1, scale: 0.5 }}
            animate={{ y: '100vh', opacity: 0, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeIn' }}
            className="absolute top-0 text-2xl select-none"
          >
            🪙
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {counter > 0 && (
          <motion.div
            key={counter}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.3, y: -40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-2xl z-50 pointer-events-none"
          >
            +{amount} 🪙
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
