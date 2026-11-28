import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Creates a user inside the caller's transaction. */
  async create(
    manager: EntityManager,
    input: { email: string; name: string; passwordHash: string },
  ): Promise<User> {
    const email = normalizeEmail(input.email);
    if (await manager.existsBy(User, { email })) {
      throw new ConflictException(
        'An Aby Socials account already uses this email. Log in instead.',
      );
    }
    return manager.save(
      manager.create(User, { ...input, email, lastSignInAt: null }),
    );
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user)
      throw new NotFoundException(
        'We couldn’t find your Aby Socials account. Log in again.',
      );
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: normalizeEmail(email) });
  }

  /** The user with their password hash, for sign-in only. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  async getPasswordHash(id: string): Promise<string | null> {
    const row = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
    return row?.passwordHash ?? null;
  }

  async updateProfile(id: string, changes: { name?: string }): Promise<User> {
    if (changes.name !== undefined) {
      await this.users.update(id, { name: changes.name });
    }
    return this.findByIdOrFail(id);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update(id, { passwordHash });
  }

  async remove(id: string): Promise<void> {
    await this.users.delete(id);
  }

  async touchSignIn(id: string): Promise<void> {
    await this.users.update(id, { lastSignInAt: new Date() });
  }
}
