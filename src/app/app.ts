import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CurrentUserService } from './core/session/current-user';
import { BRAND } from './design-system/shell/brand';
import { DsLogoComponent } from './design-system/shell/ds-logo.component';

/** Shell estático (não-SDUI): topo, menu lateral e área de conteúdo. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, DsLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

    <header class="topbar">
      <a class="topbar__brand" routerLink="/fila">
        <ds-logo />
        <span>{{ brand.name }} | {{ brand.portal }}</span>
      </a>
      <div class="topbar__module" aria-hidden="true">
        <ds-logo />
        <span>| {{ brand.module }}</span>
      </div>
      <div class="topbar__user">
        <span class="avatar" aria-hidden="true">{{ session.initials() }}</span>
        <span>{{ session.user().perfil }} - {{ session.user().nome }}</span>
        <button type="button" class="bell" aria-label="Notificações (novas)">
          <mat-icon>notifications</mat-icon>
          <span class="bell__dot" aria-hidden="true"></span>
        </button>
      </div>
    </header>

    <div class="frame">
      <aside class="sidebar">
        <ds-logo size="lg" />
        <nav class="sidebar__nav" aria-label="Menu principal">
          <a routerLink="/fila" routerLinkActive="active" ariaCurrentWhenActive="page">
            <mat-icon aria-hidden="true">inbox</mat-icon>
            <span>Fila</span>
          </a>
        </nav>
      </aside>
      <div class="content" id="conteudo" tabindex="-1">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .skip-link {
      position: absolute;
      left: 8px;
      top: -48px;
      z-index: 10;
      padding: 8px 12px;
      background: var(--ds-surface);
      color: var(--ds-text);
    }
    .skip-link:focus {
      top: 8px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
      height: 56px;
      padding: 0 24px;
      background: var(--ds-brand-navy);
      color: #fff;
      font-size: 16px;
    }
    .topbar__brand,
    .topbar__module,
    .topbar__user {
      display: flex;
      align-items: center;
      gap: 10px;
      color: inherit;
      text-decoration: none;
      white-space: nowrap;
    }
    .topbar__user {
      justify-self: end;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #fff;
      color: var(--ds-brand-navy);
      font-size: 12px;
      font-weight: 700;
    }
    .bell {
      position: relative;
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .bell:hover {
      background: rgb(255 255 255 / 10%);
    }
    .bell__dot {
      position: absolute;
      top: 7px;
      right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ds-brand-primary);
    }
    .frame {
      flex: 1;
      display: flex;
    }
    .sidebar {
      flex: none;
      width: 144px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      padding: 24px 0;
      background: var(--ds-brand-navy);
      border-right: 12px solid var(--ds-brand-primary);
    }
    .sidebar__nav {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 0 10px;
    }
    .sidebar__nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 4px;
      border-radius: 8px;
      color: rgb(255 255 255 / 80%);
      text-decoration: none;
      font-size: 12px;
    }
    .sidebar__nav a:hover,
    .sidebar__nav a.active {
      background: rgb(255 255 255 / 10%);
      color: #fff;
    }
    .content {
      flex: 1;
      min-width: 0;
      outline: none;
    }
    @media (max-width: 900px) {
      .sidebar,
      .topbar__module {
        display: none;
      }
      .topbar {
        grid-template-columns: 1fr auto;
      }
    }
    @media (max-width: 600px) {
      .topbar__brand span,
      .topbar__user > span:not(.avatar) {
        display: none;
      }
    }
  `,
})
export class App {
  protected readonly brand = BRAND;
  protected readonly session = inject(CurrentUserService);
}
