'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Transaction {
  id: string;
  amount: number;
  sender_id: string;
  created_at: string;
  senderName?: string;
}

export function useWallet(profileId: string, sessionId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('receiver_id', profileId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setTransactions(data);
        setTotalReceived(data.reduce((sum, t) => sum + t.amount, 0));
      }
    };

    fetchHistory();

    const channel = supabase
      .channel(`wallet:${profileId}:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'coin_transactions',
        filter: `receiver_id=eq.${profileId}`,
      }, (payload) => {
        const tx = payload.new as Transaction;
        setTransactions(prev => [tx, ...prev]);
        setTotalReceived(prev => prev + tx.amount);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId, sessionId]);

  return { transactions, totalReceived };
}
