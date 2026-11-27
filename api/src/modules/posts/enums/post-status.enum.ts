/** Lifecycle of one post on one account. */
export enum TargetStatus {
  /** Not approved yet. Agent output always starts here. */
  Draft = 'draft',
  /** Approved; the scheduler publishes it at `scheduledAt`. */
  Scheduled = 'scheduled',
  /** Claimed by a worker and being sent right now. */
  Publishing = 'publishing',
  /** Accepted by a platform that finishes publishing on its own time (TikTok). */
  Processing = 'processing',
  Published = 'published',
  Failed = 'failed',
}

/** Overall state of a post, derived from its targets (never stored). */
export enum PostStatus {
  Draft = 'draft',
  Scheduled = 'scheduled',
  Publishing = 'publishing',
  Published = 'published',
  PartiallyPublished = 'partially_published',
  Failed = 'failed',
}

export enum PostSource {
  Manual = 'manual',
  Agent = 'agent',
}

export function derivePostStatus(statuses: TargetStatus[]): PostStatus {
  const has = (s: TargetStatus) => statuses.includes(s);
  const all = (s: TargetStatus) =>
    statuses.length > 0 && statuses.every((x) => x === s);

  if (all(TargetStatus.Published)) return PostStatus.Published;
  if (has(TargetStatus.Publishing) || has(TargetStatus.Processing)) {
    return PostStatus.Publishing;
  }
  if (has(TargetStatus.Published)) return PostStatus.PartiallyPublished;
  if (has(TargetStatus.Failed)) return PostStatus.Failed;
  if (has(TargetStatus.Scheduled)) return PostStatus.Scheduled;
  return PostStatus.Draft;
}
