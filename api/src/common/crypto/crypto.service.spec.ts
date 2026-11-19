import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { CryptoService } from './crypto.service.js';

const configWith = (key: string) =>
  ({ get: () => key }) as unknown as ConfigService<EnvironmentVariables, true>;

describe('CryptoService', () => {
  const service = new CryptoService(
    configWith(randomBytes(32).toString('base64')),
  );

  it('round-trips JSON', () => {
    const secret = { accessToken: 'tok_123', nested: { a: [1, 2] } };
    const encrypted = service.encryptJson(secret);
    expect(encrypted).not.toContain('tok_123');
    expect(service.decryptJson(encrypted)).toEqual(secret);
  });

  it('uses a fresh IV every time', () => {
    expect(service.encryptJson({ a: 1 })).not.toBe(
      service.encryptJson({ a: 1 }),
    );
  });

  it('rejects tampered ciphertext', () => {
    const [v, iv, tag, data] = service.encryptJson({ a: 1 }).split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() =>
      service.decryptJson([v, iv, tag, flipped.toString('base64')].join('.')),
    ).toThrow();
  });

  it('rejects a key of the wrong size', () => {
    expect(
      () => new CryptoService(configWith(randomBytes(16).toString('base64'))),
    ).toThrow(/32 bytes/);
  });
});
