import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: accessToken } = await supabase
    .from('access_tokens')
    .select('*, live_sessions(*)')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-lg font-semibold">Lien invalide</p>
          <p className="text-white/40 text-sm">Ce lien a expiré ou a déjà été utilisé.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect(`/login?redirect=/join/${token}`);
  }

  await supabase
    .from('access_tokens')
    .update({ used: true })
    .eq('token', token);

  redirect(`/live/${accessToken.session_id}`);
}
