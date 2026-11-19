import {
  derivePostStatus,
  PostStatus,
  TargetStatus as T,
} from './post-status.enum.js';

describe('derivePostStatus', () => {
  it.each([
    [[T.Draft, T.Draft], PostStatus.Draft],
    [[T.Draft, T.Scheduled], PostStatus.Scheduled],
    [[T.Scheduled, T.Publishing], PostStatus.Publishing],
    [[T.Published, T.Published], PostStatus.Published],
    [[T.Published, T.Failed], PostStatus.PartiallyPublished],
    [[T.Published, T.Scheduled], PostStatus.PartiallyPublished],
    [[T.Failed, T.Scheduled], PostStatus.Failed],
    [[], PostStatus.Draft],
  ])('%j → %s', (statuses, expected) => {
    expect(derivePostStatus(statuses)).toBe(expected);
  });
});
