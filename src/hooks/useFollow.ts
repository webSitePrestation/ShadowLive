'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useFollow(followerId: string, followingId: string) {
  const supabase = createClient();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [{ count }, { data: row }] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', followingId),
      supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle(),
    ]);

    setFollowersCount(count ?? 0);
    setIsFollowing(Boolean(row));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client Supabase
  }, [followerId, followingId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const toggleFollow = useCallback(async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', followerId)
          .eq('following_id', followingId);
        if (error) console.warn('[useFollow] delete', error);
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: followerId,
          following_id: followingId,
        });
        if (error) console.warn('[useFollow] insert', error);
      }
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [isFollowing, followerId, followingId, refresh]);

  return { isFollowing, followersCount, toggleFollow, loading, refresh };
}
