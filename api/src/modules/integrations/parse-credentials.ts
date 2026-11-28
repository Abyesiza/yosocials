import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Turns untrusted credentials input into a validated instance of a provider's
 * credentials DTO, rejecting unknown fields.
 */
export async function parseCredentialsDto<T extends object>(
  dto: ClassConstructor<T>,
  raw: unknown,
  field = 'credentials',
): Promise<T> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException(
      field === 'options'
        ? 'Fill in the post settings and try again.'
        : 'Fill in the account details and try again.',
    );
  }
  const instance = plainToInstance(dto, raw);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw new BadRequestException([
      ...new Set(errors.flatMap((e) => Object.values(e.constraints ?? {}))),
    ]);
  }
  return instance;
}
