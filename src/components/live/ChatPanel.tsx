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
  ADMIN: 'text-yellow-400',
  SOUMIS: 'text-white/60',
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
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm leading-relaxed"
            >
              {msg.type === 'COIN_GIFT' ? (
                <span className="text-yellow-400/80">
                  🪙 <span className="font-semibold">{msg.content}</span>
                </span>
              ) : (
                <>
                  <span className={`font-semibold mr-1 ${roleColors[profile.role] ?? 'text-white/60'}`}>
                    {profile.username}
                  </span>
                  <span className="text-white/80">{msg.content}</span>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          maxLength={200}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-600/40 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="text-red-500 hover:text-red-400 disabled:opacity-30 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
