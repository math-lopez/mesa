import { Injectable, computed, signal } from '@angular/core';

export interface CurrentUser {
  readonly nome: string;
  readonly perfil: string;
}

/**
 * Usuário logado. Por enquanto fixo; virá do BFF (`GET /v1/me`) quando a
 * autenticação for integrada — os consumidores já dependem só deste serviço.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  readonly #user = signal<CurrentUser>({ nome: 'Maria Silva', perfil: 'Analista' });

  readonly user = this.#user.asReadonly();
  readonly initials = computed(() =>
    this.#user()
      .nome.split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}
