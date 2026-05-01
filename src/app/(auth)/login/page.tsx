'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'magic' | 'password';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const supabase = createClient();

  const handlePasswordLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Email ou mot de passe incorrect.');
    } else {
      router.push(redirectTo);
      router.refresh();
    }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 tracking-widest uppercase">Shadow</h1>
          <p className="text-yellow-600/70 text-sm mt-1 tracking-widest">LIVE</p>
        </div>

        {sent ? (
          <div className="text-center space-y-2">
            <p className="text-white">Vérifie ta boîte mail.</p>
            <p className="text-white/50 text-sm">Un lien de connexion t'a été envoyé.</p>
          </div>
        ) : (
          <div className="space-y-4" suppressHydrationWarning>
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-600/60 transition-colors"
            />

            {mode === 'password' && (
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-600/60 transition-colors"
              />
            )}

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              onClick={mode === 'password' ? handlePasswordLogin : handleMagicLink}
              disabled={loading || !email || (mode === 'password' && !password)}
              className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors tracking-wide"
            >
              {loading ? 'Connexion...' : 'Continuer'}
            </button>

            {mode === 'password' && !password && (
              <p className="text-white/40 text-xs text-center">
                Saisis le mot de passe ou bascule en lien email.
              </p>
            )}

            <button
              onClick={() => setMode(m => m === 'password' ? 'magic' : 'password')}
              className="w-full text-white/30 hover:text-white/60 text-sm transition-colors"
            >
              {mode === 'password' ? 'Connexion par lien email →' : '← Connexion par mot de passe'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
