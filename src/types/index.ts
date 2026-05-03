export type UserRole = 'ADMIN' | 'DOMINA' | 'SOUMIS';
export type SessionStatus = 'PENDING' | 'LIVE' | 'ENDED';
export type MessageType = 'TEXT' | 'COIN_GIFT' | 'SYSTEM';
export type TransactionType = 'GIFT' | 'REFUND' | 'ADMIN_GRANT';
export type TokenRole = 'SOUMIS' | 'DOMINA_GUEST';

export interface Profile {
  id: string;
  auth_user_id: string;
  username: string;
  avatar_url: string | null;
  role: UserRole;
  coins_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LiveSession {
  id: string;
  domina_id: string;
  title: string;
  status: SessionStatus;
  agora_channel: string;
  agora_token: string | null;
  guest_soumis_id: string | null;
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  min_coins_per_gift?: number | null;
  max_coins_per_gift?: number | null;
  cooldown_seconds?: number | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  metadata: Record<string, unknown>;
  created_at: string;
  sender?: Pick<Profile, 'username' | 'avatar_url' | 'role'>;
}

export interface CoinTransaction {
  id: string;
  session_id: string | null;
  sender_id: string;
  receiver_id: string;
  amount: number;
  type: TransactionType;
  created_at: string;
}

export type DuoRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface DuoRequest {
  id: string;
  session_id: string;
  domina_id: string;
  soumis_id: string;
  status: DuoRequestStatus;
  created_at: string;
}

export interface AccessToken {
  id: string;
  session_id: string;
  created_by: string;
  token: string;
  role: TokenRole;
  used: boolean;
  expires_at: string | null;
  created_at: string;
}

export type StageRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REMOVED';
export type StageRequestType = 'RAISE_HAND' | 'DUO_INVITE';

export interface StageRequest {
  id: string;
  session_id: string;
  requester_id: string;
  status: StageRequestStatus;
  type: StageRequestType;
  created_at: string;
  updated_at: string;
  requester?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>;
}

export interface StageParticipant {
  id: string;
  session_id: string;
  profile_id: string;
  agora_uid: number;
  mic_muted: boolean;
  cam_off: boolean;
  is_on_stage: boolean;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>;
}
