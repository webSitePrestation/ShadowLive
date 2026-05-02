import { cn } from '@/lib/utils/cn';

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export default function Avatar({ username, avatarUrl, size = 'md', className }: AvatarProps) {
  const initial = username?.[0]?.toUpperCase() ?? '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={cn('rounded-full object-cover border border-yellow-700/20', sizes[size], className)}
      />
    );
  }

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-bold',
      'bg-gradient-to-br from-red-900/60 to-red-800/40',
      'border border-red-700/20 text-red-300',
      sizes[size],
      className
    )}>
      {initial}
    </div>
  );
}
