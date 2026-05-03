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
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(username, avatar_url, role)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        const { data: fallback } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(50);
        setMessages(fallback ?? []);
      } else {
        setMessages((data ?? []) as ChatMessage[]);
      }
      setLoading(false);
    };

    void fetchMessages();

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, async (payload) => {
        const row = payload.new as ChatMessage;
        const { data: sender } = await supabase
          .from('profiles')
          .select('username, avatar_url, role')
          .eq('id', row.sender_id)
          .single();
        setMessages(prev => [...prev, { ...row, sender: sender ?? undefined }]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (!id) return;
        setMessages(prev => prev.filter(m => m.id !== id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client Supabase stable par session
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

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  }, [supabase]);

  return { messages, loading, sendMessage, deleteMessage };
}
