import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from '../(app)/dashboard/DashboardClient';

export default async function DashboardRouter() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  if (profile.role === 'SOUMIS') {
    redirect('/explore');
  }

  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('domina_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return <DashboardClient profile={profile} sessions={sessions ?? []} />;
}
