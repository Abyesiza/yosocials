import type {
  MediaCapabilities,
  PublishMedia,
} from './interfaces/platform-provider.interface.js';
import { mediaIssues } from './media-spec.js';

const caps: MediaCapabilities = {
  required: false,
  video: true,
  maxImages: 4,
  imageSpec: {
    types: ['image/jpeg', 'image/png'],
    maxBytes: 5_000_000,
    maxLongSide: 4096,
    maxShortSide: 2048,
    aspect: { min: 1 / 3, max: 3 },
  },
  videoSpec: {
    types: ['video/mp4'],
    codecs: ['avc'],
    maxBytes: 100_000_000,
    minDurationSec: 3,
    maxDurationSec: 140,
    maxLongSide: 1280,
    maxShortSide: 1024,
    minShortSide: 144,
  },
};

const photo = (over: Partial<PublishMedia> = {}): PublishMedia => ({
  kind: 'image',
  url: 'https://abysocials.test/media/a.jpg',
  contentType: 'image/jpeg',
  size: 300_000,
  width: 1080,
  height: 1350,
  ...over,
});

const video = (over: Partial<PublishMedia> = {}): PublishMedia => ({
  kind: 'video',
  url: 'https://abysocials.test/media/a.mp4',
  contentType: 'video/mp4',
  size: 20_000_000,
  width: 720,
  height: 1280,
  durationSec: 42,
  ...over,
});

describe('mediaIssues', () => {
  it('accepts media that fits', () => {
    expect(mediaIssues([photo(), photo()], caps)).toEqual([]);
    expect(mediaIssues([video()], caps)).toEqual([]);
  });

  it('ignores platforms that take no media and posts without any', () => {
    expect(mediaIssues([photo()], undefined)).toEqual([]);
    expect(mediaIssues([], caps)).toEqual([]);
  });

  it.each([
    [
      'too many photos',
      [photo(), photo(), photo(), photo(), photo()],
      /up to 4 photos/,
    ],
    [
      'a format the platform refuses',
      [photo({ contentType: 'image/webp' })],
      /JPEG or PNG photos/,
    ],
    ['a photo over the byte limit', [photo({ size: 6_000_000 })], /up to 5 MB/],
    [
      'a photo too large on its long side',
      [photo({ width: 5000, height: 2000 })],
      /4096×2048/,
    ],
    [
      'a photo too large on its short side, either way round',
      [photo({ width: 2100, height: 2100 })],
      /4096×2048/,
    ],
    [
      'a photo narrower than allowed',
      [photo({ width: 300, height: 1000 })],
      /less tall: the narrowest shape allowed is 1:3/,
    ],
    [
      'a video too long',
      [video({ durationSec: 200 })],
      /up to 2:20 long. This one is 3:20/,
    ],
    ['a video too short', [video({ durationSec: 1 })], /at least 3 seconds/],
    ['a video too large', [video({ width: 1080, height: 1920 })], /1280×1024/],
    [
      'a video too small',
      [video({ width: 100, height: 100 })],
      /at least 144 pixels/,
    ],
  ])('reports %s', (_, media, message) => {
    const issues = mediaIssues(media, caps);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(message);
  });

  it('suggests preparing the media again for problems a new copy fixes, but not for length', () => {
    expect(mediaIssues([photo({ size: 6_000_000 })], caps)[0]).toMatch(
      /add it again/,
    );
    expect(mediaIssues([video({ durationSec: 200 })], caps)[0]).not.toMatch(
      /add it again/,
    );
  });

  it('skips dimension checks for media attached before sizes were recorded', () => {
    expect(mediaIssues([photo({ width: null, height: null })], caps)).toEqual(
      [],
    );
  });

  it('refuses media a platform doesn’t take at all', () => {
    const textAndPhotos = { ...caps, video: false, videoSpec: null };
    expect(mediaIssues([video()], textAndPhotos)[0]).toMatch(
      /doesn’t take videos/,
    );
  });
});
