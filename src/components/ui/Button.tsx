'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'red' | 'gold' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

const variants = {
  red: 'bg-red-800 hover:bg-red-700 text-white glow-red-sm border border-red-700/30',
  gold: 'bg-transparent border border-yellow-600/40 text-yellow-500 hover:border-yellow-500/60 hover:text-yellow-400',
  ghost: 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5',
  danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-base rounded-2xl',
};

export default function Button({
  children, onClick, disabled, variant = 'red',
  size = 'md', className, type = 'button', fullWidth
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'font-semibold tracking-wide transition-all duration-200',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        'flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </motion.button>
  );
}
