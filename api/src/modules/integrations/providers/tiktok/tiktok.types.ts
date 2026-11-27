/** Shapes of the TikTok API v2 responses this provider reads. */

export interface TikTokEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; log_id?: string };
}

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface TikTokUser {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
  profile_deep_link?: string;
}

export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY';

export interface TikTokCreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: TikTokPrivacyLevel[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export interface TikTokPublishStatus {
  status:
    | 'PROCESSING_UPLOAD'
    | 'PROCESSING_DOWNLOAD'
    | 'SEND_TO_USER_INBOX'
    | 'PUBLISH_COMPLETE'
    | 'FAILED';
  fail_reason?: string;
  // Spelled this way by TikTok.
  publicaly_available_post_id?: (number | string)[];
}

export interface TikTokVideo {
  id: string;
  share_url?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}
