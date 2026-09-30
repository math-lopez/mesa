import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, tap } from 'rxjs';

import { BFF_BASE_URL } from '../api/bff-api.config';
import { DebugLogger } from './debug-logger';

let sequence = 0;

/**
 * Registra cada chamada ao BFF e sua resposta, numeradas (#1, #2...) para
 * casar ida e volta. Fica DEPOIS do authInterceptor (mostra o header) e ANTES
 * do BFF (mock ou real) — é exatamente o que trafega na rede.
 */
export const debugHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const debug = inject(DebugLogger);
  const baseUrl = inject(BFF_BASE_URL);
  if (!debug.enabled || !req.url.startsWith(baseUrl)) return next(req);

  const id = ++sequence;
  const started = performance.now();
  const target = `${req.method} ${req.urlWithParams.slice(baseUrl.length)}`;
  const elapsed = () => `${Math.round(performance.now() - started)} ms`;
  let settled = false;

  debug.log('http', `→ #${id} ${target}`, {
    ...(req.body != null && { corpo: req.body }),
    authorization: maskToken(req.headers.get('Authorization')),
  });

  return next(req).pipe(
    tap({
      next: (event) => {
        if (!(event instanceof HttpResponse)) return;
        settled = true;
        debug.log('http', `← #${id} ${event.status} ${target} (${elapsed()})`, { resposta: event.body });
      },
      error: (error: unknown) => {
        settled = true;
        const status = error instanceof HttpErrorResponse ? error.status : '?';
        debug.log('http', `✕ #${id} ${status} ${target} (${elapsed()})`, {
          erro: error instanceof HttpErrorResponse ? error.error : error,
        });
      },
    }),
    // httpResource cancela a requisição anterior quando os parâmetros mudam.
    finalize(() => settled || debug.log('http', `⊘ #${id} cancelada ${target} (${elapsed()})`)),
  );
};

/** O token é opaco para o front: mostramos só que ele foi enviado. */
function maskToken(header: string | null): string {
  if (!header) return '(sem token)';
  const token = header.replace(/^Bearer /, '');
  return `Bearer ${token.slice(0, 12)}…${token.slice(-6)} (${token.length} caracteres)`;
}
