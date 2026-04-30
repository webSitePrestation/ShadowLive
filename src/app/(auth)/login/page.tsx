'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSent(true);
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
          <div className="space-y-4">
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-600/60 transition-colors"
            />
            <button
              onClick={handleLogin}
              disabled={loading || !email}
              className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors tracking-wide"
            >
              {loading ? 'Envoi...' : 'Continuer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
