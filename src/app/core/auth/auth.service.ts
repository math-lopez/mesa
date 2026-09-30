import { Injectable, computed, signal } from '@angular/core';

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

  readonly token = this.#token.asReadonly();
  readonly isAuthenticated = computed(() => this.#token() !== null);

  signIn(token: string): void {
    this.#token.set(token);
    writeStoredToken(token);
  }

  signOut(): void {
    this.#token.set(null);
    writeStoredToken(null);
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
