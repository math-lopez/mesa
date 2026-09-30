import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SduiComponent, SduiEventEmitter, SduiUiEvent, SduiViewOf } from '../../core/sdui';

/** Contador clicável (atalho de filtro): "Disponíveis para pegar (45)". */
@Component({
  selector: 'ds-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'props().tone ?? "info"' },
  template: `
    <button
      type="button"
      class="counter"
      [class.active]="props().active"
      [attr.aria-pressed]="props().active"
      [attr.aria-disabled]="props().disabled"
      [attr.aria-busy]="props().loading"
      (click)="props().disabled || sduiEvent.emit({ type: 'click' })"
    >
      {{ props().label }}
      <strong>({{ props().count ?? '–' }})</strong>
    </button>
  `,
  styles: `
    .counter {
      height: 40px;
      padding: 0 18px;
      border: 1.5px solid var(--ds-tone-accent);
      border-radius: 8px;
      background: var(--ds-surface);
      color: var(--ds-text);
      font: var(--mat-sys-body-large);
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 120ms ease;
    }
    .counter strong {
      color: var(--ds-tone-accent);
    }
    .counter:hover,
    .counter.active {
      background: var(--ds-tone-bg);
    }
    .counter.active {
      box-shadow: inset 0 0 0 1px var(--ds-tone-accent);
    }
    .counter:focus-visible {
      outline: 2px solid var(--ds-tone-accent);
      outline-offset: 2px;
    }
    .counter[aria-disabled='true'] {
      cursor: default;
      opacity: 0.7;
    }
  `,
})
export class DsCounterComponent implements SduiComponent<SduiViewOf<'action.counter'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'action.counter'>>();
  readonly sduiEvent = output<SduiUiEvent>();
}
