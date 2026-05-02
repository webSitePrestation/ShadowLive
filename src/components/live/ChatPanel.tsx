'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import type { ChatMessage, Profile } from '@/types';

interface Props {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  profile: Profile;
}

const roleColors: Record<string, string> = {
  DOMINA: 'text-red-400',
  ADMIN: 'text-yellow-500',
  SOUMIS: 'text-white/50',
};

export default function ChatPanel({ messages, onSend, profile }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.slice(-30).map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm leading-relaxed"
            >
              {msg.type === 'COIN_GIFT' ? (
                <span className="inline-flex items-center gap-1 bg-yellow-900/30 border border-yellow-700/20 rounded-full px-2.5 py-0.5 text-yellow-400 text-xs">
                  🪙 {msg.content}
                </span>
              ) : (
                <span>
                  <span className={`font-semibold mr-1.5 text-xs ${roleColors[profile.role] ?? 'text-white/50'}`}>
                    {profile.username}
                  </span>
                  <span className="text-white/75 text-xs">{msg.content}</span>
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
