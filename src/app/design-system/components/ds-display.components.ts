import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { SduiComponent, SduiFormatPipe, SduiTone, SduiViewOf, resolveTone } from '../../core/sdui';

let nextId = 0;

@Component({
  selector: 'ds-field',
  imports: [SduiFormatPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'labelId',
    '[style.--ds-span]': 'props().span ?? 1',
    '[class.emphasis]': 'props().emphasis',
  },
  template: `
    <span class="field__label" [id]="labelId">{{ props().label }}</span>
    <span class="field__value">{{ props().value | sduiFormat: props().format }}</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .field__label {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .field__value {
      font: var(--mat-sys-body-large);
      overflow-wrap: anywhere;
    }
    :host(.emphasis) .field__value {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-primary);
    }
  `,
})
export class DsFieldComponent implements SduiComponent<SduiViewOf<'display.field'>> {
  readonly props = input.required<SduiViewOf<'display.field'>>();
  protected readonly labelId = `ds-field-${nextId++}`;
}

@Component({
  selector: 'ds-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'tone()' },
  template: `
    @if (props().label) {
      <span class="badge__label">{{ props().label }}:</span>
    }
    <strong>{{ props().value }}</strong>
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 4px 12px;
      border-radius: 999px;
      font: var(--mat-sys-label-large);
      background: var(--ds-tone-bg);
      color: var(--ds-tone-fg);
    }
    .badge__label {
      font-weight: 400;
    }
  `,
})
export class DsBadgeComponent implements SduiComponent<SduiViewOf<'display.badge'>> {
  readonly props = input.required<SduiViewOf<'display.badge'>>();
  protected readonly tone = computed(() =>
    resolveTone(this.props().value, this.props().toneMap, this.props().tone),
  );
}

const ALERT_ICON: Record<SduiTone, string> = {
  neutral: 'info',
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  danger: 'error',
};

@Component({
  selector: 'ds-alert',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-tone]': 'props().tone',
    '[attr.role]': 'props().tone === "danger" || props().tone === "warning" ? "alert" : "status"',
  },
  template: `
    <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    <div>
      @if (props().title) {
        <strong class="alert__title">{{ props().title }}</strong>
      }
      <span>{{ props().message }}</span>
    </div>
  `,
  styles: `
    :host {
      flex-basis: 100%;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--ds-tone-bg);
      color: var(--ds-tone-fg);
      font: var(--mat-sys-body-medium);
    }
    .alert__title {
      display: block;
    }
  `,
})
export class DsAlertComponent implements SduiComponent<SduiViewOf<'display.alert'>> {
  readonly props = input.required<SduiViewOf<'display.alert'>>();
  protected readonly icon = computed(() => ALERT_ICON[this.props().tone]);
}
