/** Shapes of the LinkedIn API responses this provider reads. */

export interface LinkedInTokenResponse {
  access_token: string;
  /** Seconds; 60 days for self-serve apps. */
  expires_in: number;
  /** Only for apps approved for programmatic refresh. Doesn't rotate. */
  refresh_token?: string;
  refresh_token_expires_in?: number;
  /** Space- or comma-separated, depending on the endpoint's mood. */
  scope: string;
  error?: string;
  error_description?: string;
}

/** OpenID Connect userinfo (`/v2/userinfo`). */
export interface LinkedInUserInfo {
  /** The member id: the person URN is `urn:li:person:{sub}`. */
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/** Error body of the REST and OAuth endpoints. */
export interface LinkedInErrorBody {
  message?: string;
  status?: number;
  code?: string;
  serviceErrorCode?: number;
  error?: string;
  error_description?: string;
}

export interface LinkedInImageUpload {
  value: { uploadUrl: string; image: string; uploadUrlExpiresAt?: number };
}

export interface LinkedInVideoUpload {
  value: {
    video: string;
    uploadToken: string;
    uploadInstructions: {
      uploadUrl: string;
      firstByte: number;
      lastByte: number;
    }[];
  };
}

export interface LinkedInVideo {
  id: string;
  status: 'WAITING_UPLOAD' | 'PROCESSING' | 'AVAILABLE' | 'PROCESSING_FAILED';
  processingFailureReason?: string;
}

export type LinkedInMetricType =
  'IMPRESSION' | 'REACTION' | 'COMMENT' | 'RESHARE';

export interface LinkedInPostAnalytics {
  elements: {
    count: number;
    metricType: LinkedInMetricType | Record<string, string>;
  }[];
}
