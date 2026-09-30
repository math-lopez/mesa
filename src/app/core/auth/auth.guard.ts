import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Sem sessão → login (na simulação, `/entrar`; em produção, redirect ao SSO). */
export const authGuard: CanMatchFn = (_route, segments) => {
  if (inject(AuthService).isAuthenticated()) return true;
  const redirect = '/' + segments.map((segment) => segment.path).join('/');
  return inject(Router).createUrlTree(['/entrar'], { queryParams: { redirect } });
};
