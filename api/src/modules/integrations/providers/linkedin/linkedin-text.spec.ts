import { toLittleText } from './linkedin-text.js';

describe('toLittleText', () => {
  it.each([
    [
      'leaves plain text alone',
      'Hello, world. Big news today!',
      'Hello, world. Big news today!',
    ],
    [
      'keeps hashtags as hashtags',
      'New release #launch #UgandaTech',
      'New release #launch #UgandaTech',
    ],
    [
      'escapes a # that doesn’t start a hashtag',
      'We’re #1 ... item #',
      'We’re #1 ... item \\#',
    ],
    ['escapes # inside a word', 'C#', 'C\\#'],
    [
      'escapes brackets and parentheses',
      'See [docs] (soon)',
      'See \\[docs\\] \\(soon\\)',
    ],
    [
      'escapes @, so nothing becomes a broken mention',
      'Thanks @aby',
      'Thanks \\@aby',
    ],
    ['escapes the formatting characters', 'a*b_c~d|e', 'a\\*b\\_c\\~d\\|e'],
    [
      'escapes braces, angle brackets and backslashes',
      '{x} <y> \\z',
      '\\{x\\} \\<y\\> \\\\z',
    ],
  ])('%s', (_, input, expected) => {
    expect(toLittleText(input)).toBe(expected);
  });
});
