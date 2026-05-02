'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Crown, X } from 'lucide-react';

interface Props {
  invite: {
    token: string;
    sessionTitle: string;
    dominaName: string;
  } | null;
  onDismiss: () => void;
}

export default function InviteToast({ invite, onDismiss }: Props) {
  const router = useRouter();

  const handleAccept = () => {
    if (!invite) return;
    onDismiss();
    router.push(`/join/${encodeURIComponent(invite.token)}`);
  };

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 inset-x-4 z-50 surface-luxury rounded-2xl p-4 max-w-sm mx-auto"
          style={{ borderColor: 'rgba(184,134,11,0.25)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-700/20 flex items-center justify-center shrink-0">
              <Crown size={18} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-yellow-500/80 text-xs uppercase tracking-widest mb-0.5">
                Invitation privée
              </p>
              <p className="text-white text-sm font-semibold truncate">
                {invite.dominaName} t'invite
              </p>
              <p className="text-white/40 text-xs truncate mt-0.5">
                {invite.sessionTitle}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAccept}
                  className="flex-1 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors glow-red-sm"
                >
                  Rejoindre
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 text-xs py-2 rounded-lg transition-colors border border-white/8"
                >
                  Ignorer
                </button>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-white/20 hover:text-white/50 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
