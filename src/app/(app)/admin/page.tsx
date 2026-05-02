import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') redirect('/dashboard');

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return <AdminClient currentAdmin={profile} users={users ?? []} />;
}
