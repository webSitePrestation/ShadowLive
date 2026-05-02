import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InviteNotificationLayer from '@/components/live/InviteNotificationLayer';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) redirect('/login');

  return (
    <div className="min-h-screen bg-black text-white">
      <InviteNotificationLayer profileId={profile.id} role={profile.role}>
        {children}
      </InviteNotificationLayer>
    </div>
  );
}
