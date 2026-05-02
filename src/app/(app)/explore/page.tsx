import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExploreClient from './ExploreClient';

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Redirige Domina et Admin vers leur dashboard
  if (profile.role === 'DOMINA' || profile.role === 'ADMIN') {
    redirect('/dashboard');
  }

  const { data: liveSessions } = await supabase
    .from('live_sessions')
    .select('*, profiles!live_sessions_domina_id_fkey(id, username, avatar_url)')
    .eq('status', 'LIVE')
    .order('viewer_count', { ascending: false });

  return <ExploreClient profile={profile} sessions={liveSessions ?? []} />;
}
