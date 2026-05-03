import type { LiveSession, Profile } from '@/types';

export type ExploreSessionWithDomina = LiveSession & {
  profiles: Pick<Profile, 'id' | 'username' | 'avatar_url'> | null;
  /** Renseigné côté explore pour les cards LIVE */
  dominaFollowersCount?: number;
  followedByViewer?: boolean;
};

export type FollowedDomina = Pick<Profile, 'id' | 'username' | 'avatar_url'> & {
  liveSessionId: string | null;
};
