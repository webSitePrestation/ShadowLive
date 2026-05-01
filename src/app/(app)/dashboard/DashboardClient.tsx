'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Plus, LogOut, Crown, Users, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile, LiveSession } from '@/types';

interface Props {
  profile: Profile;
  sessions: LiveSession[];
}

export default function DashboardClient({ profile, sessions }: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleCreateSession = async () => {
    if (!title.trim()) return;
    setCreating(true);

    console.log('[ShadowLive] Création session pour profil:', profile.id, 'role:', profile.role);

    const insertData = {
      domina_id: profile.id,
      title: title.trim(),
      status: 'PENDING' as const,
      agora_channel: crypto.randomUUID(),
    };

    console.log('[ShadowLive] Données à insérer:', insertData);

    const { data, error } = await supabase
      .from('live_sessions')
      .insert(insertData)
      .select()
      .single();

    console.log('[ShadowLive] Résultat:', { data, error });

    if (error) {
      console.error('[ShadowLive] Erreur complète:', JSON.stringify(error, null, 2));
      alert(`Erreur: ${error.message} (code: ${error.code})`);
      setCreating(false);
      return;
    }

    if (data) {
      router.push(`/live/${data.id}`);
    }
    setCreating(false);
  };

  const getRoleBadge = () => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      DOMINA: 'bg-red-500/20 text-red-400 border-red-500/30',
      SOUMIS: 'bg-white/10 text-white/60 border-white/20',
    };
    return colors[profile.role] ?? colors.SOUMIS;
  };

  return (
    <div className="min-h-screen bg-black p-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-red-600 uppercase">Shadow</h1>
          <p className="text-yellow-600/60 text-xs tracking-widest">LIVE</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${getRoleBadge()}`}>
            {profile.role}
          </span>
          <button
            onClick={handleSignOut}
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-600/30 flex items-center justify-center">
            <Crown size={24} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-white text-lg">{profile.username}</p>
            <p className="text-white/40 text-sm">{profile.coins_balance} pièces</p>
          </div>
        </div>
      </motion.div>

      {/* Créer un live — Domina seulement */}
      {(profile.role === 'DOMINA' || profile.role === 'ADMIN') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 active:scale-95 transition-all text-white font-semibold py-4 rounded-2xl tracking-wide"
            >
              <Plus size={20} />
              Nouveau Live
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-red-600/20 rounded-2xl p-5 space-y-4"
            >
              <p className="text-white/60 text-sm font-medium tracking-wide uppercase">Titre du live</p>
              <input
                autoFocus
                type="text"
                placeholder="Session privée..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                maxLength={80}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-red-600/50 transition-colors"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowForm(false); setTitle(''); }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white/80 transition-colors text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={creating || !title.trim()}
                  className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Radio size={16} />
                  {creating ? 'Création...' : 'Lancer'}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Historique des sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Sessions récentes</p>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-white/20">
            <Radio size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun live pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                onClick={() => router.push(`/live/${session.id}`)}
                className="bg-white/5 border border-white/10 hover:border-red-600/30 rounded-xl p-4 cursor-pointer transition-all active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{session.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-white/30 text-xs">
                        <Users size={11} />
                        {session.viewer_count}
                      </span>
                      <span className="flex items-center gap-1 text-white/30 text-xs">
                        <Clock size={11} />
                        {new Date(session.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ml-3 shrink-0 ${
                    session.status === 'LIVE'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : session.status === 'PENDING'
                      ? 'bg-yellow-500/10 text-yellow-500/60 border border-yellow-500/20'
                      : 'bg-white/5 text-white/30 border border-white/10'
                  }`}>
                    {session.status === 'LIVE' ? '● LIVE' : session.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
