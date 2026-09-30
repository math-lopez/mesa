import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SduiComponent, SduiSlotDirective, SduiViewOf } from '../../core/sdui';

/**
 * Página SDUI. Slots:
 *  - `toolbar` à direita do título (ex.: contadores da fila)
 *  - `header`  abaixo do título (badges, alertas)
 *  - `main`    conteúdo
 *  - `footer`  barra fixa no rodapé (ações)
 */
@Component({
  selector: 'ds-page',
  imports: [SduiSlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page__header">
      <div class="page__top">
        <div class="page__titles">
          <h1 class="page__title">{{ props().title }}</h1>
          @if (props().subtitle) {
            <p class="page__subtitle">{{ props().subtitle }}</p>
          }
        </div>
        <div class="page__toolbar"><ng-container sduiSlot="toolbar" /></div>
      </div>
      <div class="page__header-slot"><ng-container sduiSlot="header" /></div>
    </header>

    <main class="page__main">
      <ng-container sduiSlot="main" />
    </main>

    <footer class="page__footer">
      <ng-container sduiSlot="footer" />
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .page__header {
      padding: 28px 40px 16px;
      display: grid;
      gap: 12px;
    }
    .page__top {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
    }
    .page__title {
      margin: 0;
      font: var(--mat-sys-headline-small);
      color: var(--ds-text);
    }
    .page__subtitle {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .page__toolbar,
    .page__header-slot {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .page__toolbar:empty,
    .page__header-slot:empty {
      display: none;
    }
    .page__main {
      flex: 1;
      display: grid;
      gap: 20px;
      padding: 0 40px 28px;
      align-content: start;
    }
    .page__footer {
      position: sticky;
      bottom: 0;
      z-index: 2;
      padding: 12px 40px;
      background: var(--ds-surface);
      border-top: 1px solid var(--ds-border);
      box-shadow: 0 -4px 12px rgb(16 24 40 / 6%);
    }
    .page__footer:empty {
      display: none;
    }
    @media (max-width: 600px) {
      .page__header,
      .page__main,
      .page__footer {
        padding-inline: 16px;
      }
    }
  `,
})
export class DsPageComponent implements SduiComponent<SduiViewOf<'layout.page'>> {
  readonly props = input.required<SduiViewOf<'layout.page'>>();
}
