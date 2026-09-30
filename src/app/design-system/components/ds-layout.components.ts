import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

import { SduiComponent, SduiSlotDirective, SduiViewOf } from '../../core/sdui';

const GAP = { sm: '8px', md: '16px', lg: '24px' } as const;

/**
 * Grid responsiva. Os filhos são criados dinamicamente (fora do escopo de CSS
 * emulado), por isso o span é aplicado via classe global + `--ds-span`, que
 * o motor define a partir de `node.span`. Colunas colapsam em telas menores.
 */
@Component({
  selector: 'ds-grid',
  imports: [SduiSlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'ds-grid',
    '[style.--ds-grid-cols]': 'props().columns',
    '[style.gap]': 'gap()',
    '[style.align-items]': 'props().align ?? "stretch"',
  },
  template: `<ng-container sduiSlot />`,
  styles: `
    .ds-grid {
      display: grid;
      grid-template-columns: repeat(var(--ds-grid-cols), minmax(0, 1fr));
    }
    .ds-grid > * {
      grid-column: span min(var(--ds-span, 1), var(--ds-grid-cols));
    }
    @media (max-width: 1100px) {
      .ds-grid {
        --ds-grid-cols: 4 !important;
      }
      .ds-grid > * {
        grid-column: span min(max(1, calc(var(--ds-span, 1) / 2)), 4);
      }
    }
    @media (max-width: 900px) {
      .ds-grid {
        --ds-grid-cols: 2 !important;
      }
      .ds-grid > * {
        grid-column: span min(var(--ds-span, 1), 2);
      }
    }
    @media (max-width: 600px) {
      .ds-grid {
        --ds-grid-cols: 1 !important;
      }
      .ds-grid > * {
        grid-column: span 1;
      }
    }
  `,
})
export class DsGridComponent implements SduiComponent<SduiViewOf<'layout.grid'>> {
  readonly props = input.required<SduiViewOf<'layout.grid'>>();
  protected gap(): string {
    return GAP[this.props().gap ?? 'md'];
  }
}

@Component({
  selector: 'ds-action-bar',
  imports: [SduiSlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    'aria-label': 'Ações',
    '[attr.data-align]': 'props().align ?? "end"',
  },
  template: `<ng-container sduiSlot />`,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: flex-end;
      align-items: center;
    }
    :host([data-align='start']) {
      justify-content: flex-start;
    }
    :host([data-align='between']) {
      justify-content: space-between;
    }
  `,
})
export class DsActionBarComponent implements SduiComponent<SduiViewOf<'layout.actionBar'>> {
  readonly props = input.required<SduiViewOf<'layout.actionBar'>>();
}
