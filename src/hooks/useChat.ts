'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage, Profile } from '@/types';

export function useChat(sessionId: string, profile: Profile) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(50);
      setMessages(data ?? []);
      setLoading(false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const sendMessage = useCallback(async (content: string, type: 'TEXT' | 'COIN_GIFT' = 'TEXT', metadata = {}) => {
    if (!content.trim()) return;
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      sender_id: profile.id,
      content: content.trim(),
      type,
      metadata,
    });
  }, [sessionId, profile.id]);

  return { messages, loading, sendMessage };
}
