import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAccessTokenExpired } from '@/lib/access-token';

interface Props {
  params: Promise<{ token: string }>;
}

function normalizeJoinToken(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export default async function JoinPage({ params }: Props) {
  const { token: rawToken } = await params;
  const token = normalizeJoinToken(rawToken);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Avant toute requête sur access_tokens : en navigation privée sans session,
  // la lecture RLS peut échouer et afficher « lien invalide ». On envoie d'abord vers login.
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`);
  }

  // Pas d’embed live_sessions : la RLS sur live_sessions peut bloquer toute la ligne pour le soumis.
  // Filtre expiration en JS : expires_at souvent NULL en base si non renseigné à l’insert (sinon .gt côté API exclut la ligne).
  const { data: accessToken, error: tokenReadError } = await supabase
    .from('access_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle();

  const expired = accessToken ? isAccessTokenExpired(accessToken.expires_at) : false;

  if (tokenReadError || !accessToken || expired) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-lg font-semibold">Lien invalide</p>
          <p className="text-white/40 text-sm">Ce lien a expiré ou a déjà été utilisé.</p>
        </div>
      </div>
    );
  }

  const sessionId = accessToken.session_id as string;

  if (profile.role === 'SOUMIS' && accessToken.role === 'SOUMIS') {
    const { error: guestErr } = await supabase
      .from('live_sessions')
      .update({ guest_soumis_id: profile.id })
      .eq('id', sessionId);

    if (guestErr) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center space-y-3 max-w-md">
            <p className="text-red-500 text-lg font-semibold">Accès duo impossible</p>
            <p className="text-white/50 text-sm">
              {guestErr.message}. Vérifie les droits (RLS) sur live_sessions ou réessaie.
            </p>
          </div>
        </div>
      );
    }
  }

  await supabase
    .from('access_tokens')
    .update({ used: true })
    .eq('token', token);

  redirect(`/live/${sessionId}`);
}
