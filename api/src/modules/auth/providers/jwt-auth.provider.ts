import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/users.service.js';

/**
 * Accepts `Authorization: Bearer <access token>` issued by TokenService and
 * loads the user. A token for a deleted user is rejected.
 */
@Injectable()
export class JwtAuthProvider extends JwtBearerProvider<User> {
  constructor(
    private readonly users: UsersService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate(claims: JwtClaims): Promise<User | null> | null {
    return claims.sub ? this.users.findById(claims.sub) : null;
  }
}
