import { Injectable, computed, inject, signal } from '@angular/core';

import { DebugLogger } from '../debug/debug-logger';

const STORAGE_KEY = 'mesa-credito.token';

/**
 * Sessão do usuário. O front trata o token como OPACO: só guarda e envia ao
 * BFF. Grupos, mesa e permissões são decididos no servidor — nunca aqui.
 *
 * Em produção, este serviço embrulha a biblioteca OIDC do SSO corporativo
 * (login/refresh/logout); a simulação apenas recebe o token do IdP fake.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #token = signal<string | null>(readStoredToken());
  readonly #debug = inject(DebugLogger);

  readonly token = this.#token.asReadonly();
  readonly isAuthenticated = computed(() => this.#token() !== null);

  signIn(token: string): void {
    this.#token.set(token);
    writeStoredToken(token);
    this.#debug.log('auth', 'sessão iniciada (token recebido do SSO)');
  }

  signOut(): void {
    this.#token.set(null);
    writeStoredToken(null);
    this.#debug.log('auth', 'sessão encerrada');
  }
}

// sessionStorage pode estar indisponível (modo privado, política do navegador).
function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessão só em memória
  }
}
