'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export type CoinSessionConfig = {
  minCoins: number;
  maxCoins: number;
  cooldownSeconds: number;
};

const DEFAULT_SESSION_CONFIG: CoinSessionConfig = {
  minCoins: 10,
  maxCoins: 500,
  cooldownSeconds: 0,
};

export function useCoins(
  sessionId: string,
  sender: Profile,
  receiverId: string,
  sessionConfig: CoinSessionConfig = DEFAULT_SESSION_CONFIG
) {
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState(sender.coins_balance);
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const lastSentAtRef = useRef(0);
  const supabase = createClient();

  const { minCoins, maxCoins, cooldownSeconds } = sessionConfig;
  const minAllowed = Math.min(minCoins, maxCoins);
  const maxAllowed = Math.max(minCoins, maxCoins);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      setTimeUntilNext(0);
      return;
    }
    const tick = () => {
      const last = lastSentAtRef.current;
      if (!last) {
        setTimeUntilNext(0);
        return;
      }
      const remMs = cooldownSeconds * 1000 - (Date.now() - last);
      setTimeUntilNext(remMs > 0 ? Math.ceil(remMs / 1000) : 0);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [cooldownSeconds, sending]);

  const sendCoins = useCallback(
    async (amount: number) => {
      if (sending || balance < amount) return false;
      if (amount < minAllowed || amount > maxAllowed) return false;

      if (cooldownSeconds > 0 && lastSentAtRef.current > 0) {
        const elapsed = Date.now() - lastSentAtRef.current;
        if (elapsed < cooldownSeconds * 1000) return false;
      }

      setSending(true);

      const { error } = await supabase.from('coin_transactions').insert({
        session_id: sessionId,
        sender_id: sender.id,
        receiver_id: receiverId,
        amount,
        type: 'GIFT',
      });

      if (!error) {
        lastSentAtRef.current = Date.now();
        const nextBalance = balance - amount;
        setBalance(nextBalance);
        await supabase.from('profiles').update({ coins_balance: nextBalance }).eq('id', sender.id);
      }

      setSending(false);
      return !error;
    },
    [
      sending,
      balance,
      sessionId,
      sender.id,
      receiverId,
      minAllowed,
      maxAllowed,
      cooldownSeconds,
      supabase,
    ]
  );

  return { sendCoins, sending, balance, timeUntilNext };
}
