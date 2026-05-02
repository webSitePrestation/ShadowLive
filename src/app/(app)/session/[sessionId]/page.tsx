import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SessionStatsClient from './SessionStatsClient';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionStatsPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  const { data: session } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) notFound();
  if (session.domina_id !== profile.id && profile.role !== 'ADMIN') redirect('/dashboard');

  const { data: transactions } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('receiver_id', profile.id)
    .order('created_at', { ascending: true });

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId);

  return (
    <SessionStatsClient
      session={session}
      profile={profile}
      transactions={transactions ?? []}
      messageCount={messages?.length ?? 0}
    />
  );
}
