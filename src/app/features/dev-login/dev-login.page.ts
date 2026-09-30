import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { MOCK_PROFILES, MockProfile, issueMockToken } from '../../core/mocks/mock-identity';

/**
 * Login SIMULADO (só existe com `useMockBff`). Faz o papel do SSO corporativo:
 * emite um token com os grupos do perfil escolhido. Em produção esta rota
 * não é registrada e o guard redireciona ao IdP.
 */
@Component({
  selector: 'app-dev-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login">
      <h1>Entrar (simulação do SSO)</h1>
      <p class="hint">
        Escolha um perfil. O token emitido carrega os <strong>grupos</strong> do usuário; o BFF usa
        esses grupos para decidir a mesa e montar a fila correspondente.
      </p>
      <ul class="profiles">
        @for (profile of profiles; track profile.sub) {
          <li>
            <button type="button" class="profile" (click)="signIn(profile)">
              <span class="profile__name">{{ profile.title }} · {{ profile.name }}</span>
              <span class="profile__desc">{{ profile.description }}</span>
              <span class="profile__groups">
                @for (group of profile.groups; track group) {
                  <code>{{ group }}</code>
                }
              </span>
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .login {
      max-width: 760px;
      padding: 32px 40px;
    }
    h1 {
      margin: 0 0 8px;
      font: var(--mat-sys-headline-small);
    }
    .hint {
      margin: 0 0 24px;
      color: var(--mat-sys-on-surface-variant);
    }
    .profiles {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .profile {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 16px 20px;
      border: 1px solid var(--ds-border);
      border-radius: 10px;
      background: var(--ds-surface);
      box-shadow: var(--ds-shadow-sm);
      text-align: left;
      font: inherit;
      color: var(--ds-text);
      cursor: pointer;
    }
    .profile:hover,
    .profile:focus-visible {
      border-color: var(--ds-brand-primary);
      outline: none;
    }
    .profile__name {
      font: var(--mat-sys-title-medium);
    }
    .profile__desc {
      color: var(--mat-sys-on-surface-variant);
    }
    .profile__groups {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }
    code {
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--ds-surface-muted);
      font-size: 12px;
    }
  `,
})
export class DevLoginPage {
  readonly redirect = input<string>();
  /** Atalho para QA/links em dev: `/entrar?perfil=u-carlos` entra direto. */
  readonly perfil = input<string>();

  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  protected readonly profiles = MOCK_PROFILES;

  constructor() {
    effect(() => {
      const profile = MOCK_PROFILES.find((p) => p.sub === this.perfil());
      if (profile) untracked(() => this.signIn(profile));
    });
  }

  protected signIn(profile: MockProfile): void {
    this.#auth.signIn(issueMockToken(profile));
    void this.#router.navigateByUrl(this.redirect() || '/fila');
  }
}
