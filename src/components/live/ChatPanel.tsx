'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2 } from 'lucide-react';
import type { ChatMessage, Profile } from '@/types';
import BanButton from '@/components/live/BanButton';

interface Props {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  profile: Profile;
  isDomina?: boolean;
  /** ID profil de la Domina du live — pas d’actions modération sur ses propres messages */
  dominaUserId?: string;
  onDelete?: (messageId: string) => void;
  onBan?: (userId: string, username: string) => void | Promise<void>;
}

const roleColors: Record<string, string> = {
  DOMINA: 'text-red-400',
  ADMIN: 'text-yellow-500',
  SOUMIS: 'text-white/50',
};

export default function ChatPanel({
  messages,
  onSend,
  profile,
  isDomina = false,
  dominaUserId,
  onDelete,
  onBan,
}: Props) {
  const [input, setInput] = useState('');
  const [pinnedMenuMsgId, setPinnedMenuMsgId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canModerate = Boolean(isDomina && (onDelete || onBan));
  const dominaId = dominaUserId ?? profile.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!pinnedMenuMsgId) return;
    const close = () => setPinnedMenuMsgId(null);
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [pinnedMenuMsgId]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const visible = messages.slice(-30);

  const startLongPress = (msgId: string) => {
    if (!canModerate) return;
    longPressTimer.current = window.setTimeout(() => {
      setPinnedMenuMsgId(msgId);
    }, 550);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map(msg => {
            const senderRole = msg.sender?.role ?? 'SOUMIS';
            const senderName = msg.sender?.username ?? '…';
            const isOwnDominaMessage = msg.sender_id === dominaId;
            const showMod = canModerate && !isOwnDominaMessage;
            const menuOpen = pinnedMenuMsgId === msg.id;

            return (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`text-sm leading-relaxed relative group rounded-lg pr-1 ${showMod ? 'pl-1' : ''}`}
                onPointerDown={() => startLongPress(msg.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                {msg.type === 'COIN_GIFT' ? (
                  <span className="inline-flex items-center gap-1 bg-yellow-900/30 border border-yellow-700/20 rounded-full px-2.5 py-0.5 text-yellow-400 text-xs pr-1">
                    🪙 {msg.content}
                  </span>
                ) : (
                  <span className="block pr-6">
                    <span className={`font-semibold mr-1.5 text-xs ${roleColors[senderRole] ?? 'text-white/50'}`}>
                      {senderName}
                    </span>
                    <span className="text-white/75 text-xs">{msg.content}</span>
                  </span>
                )}
                {showMod && (
                  <div
                    className={`absolute right-0 top-0 flex items-center gap-0.5 rounded-md bg-black/75 border border-white/10 p-0.5 z-[5] transition-opacity ${
                      menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {onDelete && (
                      <button
                        type="button"
                        title="Supprimer le message"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(msg.id);
                          setPinnedMenuMsgId(null);
                        }}
                        className="p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 size={12} strokeWidth={2.5} />
                      </button>
                    )}
                    {onBan && (
                      <BanButton
                        userId={msg.sender_id}
                        username={senderName}
                        onBan={async uid => {
                          await onBan(uid, senderName);
                        }}
                        className="p-1 rounded-md text-white/40 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      />
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          maxLength={200}
          className="flex-1 bg-black/60 border border-white/8 rounded-full px-4 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-red-700/40 transition-colors"
        />
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-8 h-8 rounded-full bg-red-800/60 border border-red-700/30 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-20 transition-colors shrink-0"
        >
          <Send size={13} />
        </motion.button>
      </div>
    </div>
  );
}
