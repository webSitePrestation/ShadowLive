import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LiveClient from './LiveClient';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function LivePage({ params }: Props) {
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

  const { data: domina } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', session.domina_id)
    .single();

  return (
    <LiveClient
      session={session}
      profile={profile}
      domina={domina}
    />
  );
}
