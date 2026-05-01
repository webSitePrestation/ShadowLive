'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export function useCoins(sessionId: string, sender: Profile, receiverId: string) {
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState(sender.coins_balance);
  const supabase = createClient();

  const sendCoins = useCallback(async (amount: number) => {
    if (sending || balance < amount) return false;
    setSending(true);

    const { error } = await supabase.from('coin_transactions').insert({
      session_id: sessionId,
      sender_id: sender.id,
      receiver_id: receiverId,
      amount,
      type: 'GIFT',
    });

    if (!error) {
      setBalance(b => b - amount);
      await supabase
        .from('profiles')
        .update({ coins_balance: balance - amount })
        .eq('id', sender.id);
    }

    setSending(false);
    return !error;
  }, [sending, balance, sessionId, sender.id, receiverId]);

  return { sendCoins, sending, balance };
}
