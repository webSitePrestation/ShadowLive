import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  const { data: transactions } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('sender_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return <ProfileClient profile={profile} transactions={transactions ?? []} />;
}
