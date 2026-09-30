import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { BFF_BASE_URL } from '../api/bff-api.config';
import { DebugLogger } from '../debug/debug-logger';
import { AuthService } from './auth.service';

/**
 * Anexa o token em toda chamada ao BFF (e só ao BFF). Um 401 encerra a sessão
 * e manda para o login; 403 segue para a tela tratar (ex.: proposta de outra mesa).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(BFF_BASE_URL);
  if (!req.url.startsWith(baseUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const debug = inject(DebugLogger);
  const token = auth.token();
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        debug.log('auth', '401 do BFF → encerrando sessão e indo para o login');
        auth.signOut();
        void router.navigate(['/entrar'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
