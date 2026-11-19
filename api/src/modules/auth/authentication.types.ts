import type { User } from '../users/entities/user.entity.js';

/** Types `@CurrentUser()` and `AuthenticationContext.user` as our User. */
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
