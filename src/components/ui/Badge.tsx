import { cn } from '@/lib/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'red' | 'gold' | 'ghost' | 'live';
  className?: string;
}

const variants = {
  red: 'bg-red-900/30 text-red-400 border border-red-800/30',
  gold: 'bg-yellow-900/20 text-yellow-500 border border-yellow-700/30',
  ghost: 'bg-white/5 text-white/40 border border-white/10',
  live: 'bg-red-600 text-white border border-red-500/50 pulse-live',
};

export default function Badge({ children, variant = 'ghost', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wider',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
