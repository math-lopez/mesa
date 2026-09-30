import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonAppearance, MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SduiComponent, SduiEventEmitter, SduiUiEvent, SduiViewOf } from '../../core/sdui';

type ButtonVariant = NonNullable<SduiViewOf<'action.button'>['variant']>;

const APPEARANCE: Record<ButtonVariant, MatButtonAppearance> = {
  primary: 'filled',
  danger: 'filled',
  secondary: 'outlined',
  ghost: 'text',
};

let nextId = 0;

@Component({
  selector: 'ds-button',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [matButton]="appearance()"
      [class.danger]="variant() === 'danger'"
      [class.ghost]="variant() === 'ghost'"
      [disabled]="props().disabled"
      disabledInteractive
      [matTooltip]="props().disabledReason ?? ''"
      [matTooltipDisabled]="!props().disabledReason"
      [attr.aria-busy]="props().loading"
      [attr.aria-describedby]="props().disabledReason ? reasonId : null"
      (click)="onClick()"
    >
      @if (props().loading) {
        <mat-progress-spinner mode="indeterminate" diameter="18" aria-hidden="true" />
      } @else if (props().icon; as icon) {
        <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
      }
      {{ props().label }}
    </button>
    @if (props().disabledReason) {
      <span class="ds-visually-hidden" [id]="reasonId">{{ props().disabledReason }}</span>
    }
  `,
  styles: `
    .danger:not([aria-disabled='true']):not(:disabled) {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
    .ghost {
      --mat-button-text-label-text-color: var(--ds-brand-navy);
      font-weight: 500;
    }
    mat-progress-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
  `,
})
export class DsButtonComponent implements SduiComponent<SduiViewOf<'action.button'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'action.button'>>();
  readonly sduiEvent = output<SduiUiEvent>();

  protected readonly variant = computed<ButtonVariant>(() => this.props().variant ?? 'secondary');
  protected readonly appearance = computed(() => APPEARANCE[this.variant()]);
  protected readonly reasonId = `ds-button-reason-${nextId++}`;

  protected onClick(): void {
    if (!this.props().disabled) this.sduiEvent.emit({ type: 'click' });
  }
}
