'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

type Mode = 'password' | 'magic';

function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') ?? '/dashboard';
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/dashboard';
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

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="text-4xl mb-4">📨</div>
        <p className="text-white font-medium">Vérifie ta boîte mail</p>
        <p className="text-white/30 text-sm">Un lien de connexion t'a été envoyé</p>
        <button
          onClick={() => setSent(false)}
          className="text-red-500/60 hover:text-red-400 text-sm transition-colors mt-4"
        >
          ← Retour
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <input
        type="email"
        placeholder="ton@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-red-700/50 transition-colors text-sm"
      />
      {mode === 'password' && (
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
          autoComplete="current-password"
          className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-red-700/50 transition-colors text-sm"
        />
      )}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-400 text-xs text-center bg-red-900/20 border border-red-800/20 rounded-lg py-2"
        >
          {error}
        </motion.p>
      )}
      <button
        onClick={mode === 'password' ? handlePasswordLogin : handleMagicLink}
        disabled={loading || !email || (mode === 'password' && !password)}
        className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-30 text-white font-semibold py-3.5 rounded-xl transition-all tracking-wide text-sm glow-red-sm"
      >
        {loading ? 'Connexion...' : 'Continuer'}
      </button>
      <button
        onClick={() => { setMode(m => m === 'password' ? 'magic' : 'password'); setError(''); }}
        className="w-full text-white/20 hover:text-white/50 text-xs transition-colors py-1"
      >
        {mode === 'password' ? 'Connexion par lien email →' : '← Connexion par mot de passe'}
      </button>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-5xl font-black tracking-[0.25em] text-gradient-red uppercase">
            Shadow
          </h1>
          <p className="text-xs tracking-[0.5em] text-gradient-gold uppercase mt-1">
            Live
          </p>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-800/40 to-transparent mx-auto mt-4" />
        </motion.div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
