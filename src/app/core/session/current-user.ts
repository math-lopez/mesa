import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';

import { BFF_BASE_URL } from '../api/bff-api.config';
import { AuthService } from '../auth/auth.service';

export interface MesaResumo {
  readonly codigo: string;
  readonly nome: string;
}

/** Resposta de `GET /v1/me` — o BFF traduz os claims do token para o que a UI precisa exibir. */
export interface CurrentUser {
  readonly nome: string;
  readonly perfil: string;
  readonly mesas: readonly MesaResumo[];
}

/**
 * Usuário logado, como o BFF o enxerga. Recarrega a cada troca de token.
 * Uso apenas de exibição: autorização é sempre validada no servidor.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  readonly #auth = inject(AuthService);
  readonly #baseUrl = inject(BFF_BASE_URL);

  // Novo objeto de request a cada token → nova requisição (mesmo com a URL igual).
  readonly #me = httpResource<CurrentUser>(() =>
    this.#auth.token() ? { url: `${this.#baseUrl}/v1/me` } : undefined,
  );

  readonly user = computed(() => (this.#me.hasValue() ? this.#me.value() : null));
  readonly mesasLabel = computed(() => this.user()?.mesas.map((mesa) => mesa.nome).join(' · ') ?? '');
  readonly initials = computed(() =>
    (this.user()?.nome ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
}
