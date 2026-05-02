'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Clock, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { Profile, CoinTransaction } from '@/types';

interface Props {
  profile: Profile;
  transactions: CoinTransaction[];
}

export default function ProfileClient({ profile, transactions }: Props) {
  const [username, setUsername] = useState(profile.username);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    if (!username.trim() || username === profile.username) return;
    setSaving(true);
    setError('');

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', profile.id);

    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

  const backRoute = profile.role === 'SOUMIS' ? '/explore' : '/dashboard';

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.push(backRoute)}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-bold tracking-widest text-white/70 uppercase">Mon Profil</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Avatar + infos */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-luxury rounded-2xl p-6 flex flex-col items-center gap-4"
        >
          <Avatar username={username} avatarUrl={profile.avatar_url} size="xl" />
          <div className="text-center">
            <p className="text-white font-bold text-xl">{profile.username}</p>
            <Badge
              variant={profile.role === 'ADMIN' ? 'gold' : profile.role === 'DOMINA' ? 'red' : 'ghost'}
              className="mt-2"
            >
              {profile.role === 'ADMIN' ? '👑' : profile.role === 'DOMINA' ? '⛓️' : '🖤'} {profile.role}
            </Badge>
          </div>

          {/* Solde */}
          <div className="w-full bg-black/40 rounded-xl p-4 text-center border border-yellow-800/15">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Solde actuel</p>
            <p className="text-3xl font-black text-gradient-gold">{profile.coins_balance.toLocaleString()}</p>
            <p className="text-white/20 text-xs mt-1">pièces</p>
          </div>
        </motion.div>

        {/* Modifier username */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="surface-dark rounded-2xl p-5 space-y-4"
        >
          <p className="text-white/30 text-xs uppercase tracking-widest">Modifier le pseudo</p>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={30}
            minLength={3}
            className="w-full bg-black/50 border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-white/15 focus:outline-none focus:border-yellow-700/40 transition-colors"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.p
                key="saved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-green-400 text-sm text-center"
              >
                ✓ Pseudo mis à jour
              </motion.p>
            ) : (
              <Button
                key="btn"
                variant="gold"
                size="md"
                fullWidth
                onClick={handleSave}
                disabled={saving || !username.trim() || username === profile.username}
              >
                <Save size={14} />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Historique dépenses */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-white/20 text-xs uppercase tracking-widest">Historique des dons</p>
            {totalSpent > 0 && (
              <span className="text-red-400/60 text-xs flex items-center gap-1">
                <TrendingDown size={10} />
                {totalSpent.toLocaleString()} total
              </span>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 surface-dark rounded-2xl">
              <p className="text-white/15 text-sm">Aucun don envoyé pour l'instant</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                  className="surface-dark rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🪙</span>
                    <div>
                      <p className="text-white/50 text-xs">Don envoyé</p>
                      <p className="text-white/20 text-xs flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <span className="text-red-400/80 font-bold text-sm">-{tx.amount}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
