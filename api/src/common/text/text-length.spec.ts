import { countGraphemes, textLength, xWeightedLength } from './text-length.js';

describe('xWeightedLength', () => {
  it.each([
    ['plain Latin text counts 1 per character', 'Hello, world', 12],
    ['CJK characters count 2', '日本語', 6],
    [
      'an emoji counts 2, even one built from several code points',
      '👍🏽 ok 👨‍👩‍👧',
      8,
    ],
    [
      'a link counts 23 however long it is',
      `see https://example.com/${'a'.repeat(80)}`,
      27,
    ],
    ['a bare domain is a link too', 'visit abysocials.com today', 35],
    ['www links count 23', 'www.example.org/x', 23],
    ['an email address is not a link', 'me@example.com', 14],
  ])('%s', (_, text, expected) => {
    expect(xWeightedLength(text)).toBe(expected);
  });
});

describe('textLength', () => {
  it('counts in the platform’s unit', () => {
    const text = '日本 👍🏽';
    expect(textLength(text, 'characters')).toBe(text.length);
    expect(textLength(text, 'graphemes')).toBe(countGraphemes(text));
    expect(textLength(text, 'weighted')).toBe(7);
  });
});
