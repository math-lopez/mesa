import { ChangeDetectionStrategy, Component, Injectable, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_LOCALE, NativeDateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { SduiComponent, SduiEventEmitter, SduiFieldRuntime, SduiUiEvent, SduiViewOf } from '../../core/sdui';

let nextId = 0;

/**
 * Sincroniza um FormControl local (exigido pelo Material para exibir erro)
 * com o estado que vem do motor. A fonte da verdade continua sendo o store SDUI.
 */
function syncControl<T>(
  control: FormControl<T>,
  props: () => SduiFieldRuntime<string>,
  emit: (event: SduiUiEvent) => void,
  convert: { toControl: (value: string | null) => T; fromControl: (value: T) => unknown },
): void {
  effect(() => {
    const { value, error } = props();
    const next = convert.toControl(value);
    if (!sameValue(control.value, next)) control.setValue(next, { emitEvent: false });
    control.setErrors(error ? { sdui: error } : null);
    if (error) control.markAsTouched();
  });
  control.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe((value) => emit({ type: 'change', value: convert.fromControl(value) }));
}

function sameValue(a: unknown, b: unknown): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}

const AS_STRING = {
  toControl: (value: string | null) => value ?? '',
  fromControl: (value: string) => value,
};

// Rótulo acima do campo (padrão visual da fila) — compartilhado pelos inputs.
const FIELD_STYLES = `
  :host { display: block; min-width: 0; }
  .ds-label { display: block; margin-bottom: 6px; font: var(--mat-sys-label-large); color: var(--ds-text); }
  .ds-label .req { color: var(--mat-sys-error); }
  mat-form-field { width: 100%; }
`;

@Component({
  selector: 'ds-text-input',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-label" [for]="id">
      {{ props().label }}
      @if (props().required) {
        <span class="req" aria-hidden="true">*</span>
      }
    </label>
    <mat-form-field class="ds-input" appearance="outline" subscriptSizing="dynamic">
      <input
        matInput
        [id]="id"
        [formControl]="control"
        [required]="props().required"
        [attr.maxlength]="props().maxLength"
        [placeholder]="props().placeholder ?? ''"
        (blur)="sduiEvent.emit({ type: 'blur' })"
        (keydown.enter)="sduiEvent.emit({ type: 'submit' })"
      />
      @if (props().icon; as icon) {
        <mat-icon matSuffix aria-hidden="true">{{ icon }}</mat-icon>
      }
      @if (props().hint) {
        <mat-hint>{{ props().hint }}</mat-hint>
      }
      <mat-error>{{ props().error }}</mat-error>
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
})
export class DsTextInputComponent implements SduiComponent<SduiViewOf<'input.text'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'input.text'>>();
  readonly sduiEvent = output<SduiUiEvent>();
  protected readonly id = `ds-text-${nextId++}`;
  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    syncControl(this.control, this.props, (event) => this.sduiEvent.emit(event), AS_STRING);
  }
}

/** Aceita digitação em dd/mm/aaaa (o NativeDateAdapter só entende o formato do navegador). */
@Injectable()
class PtBrDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
      if (match) {
        const [, day, month, year] = match.map(Number) as [number, number, number, number];
        const date = new Date(year, month - 1, day);
        return date.getMonth() === month - 1 ? date : this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}

@Component({
  selector: 'ds-date-input',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: DateAdapter, useClass: PtBrDateAdapter },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-label" [for]="id">{{ props().label }}</label>
    <mat-form-field class="ds-input" appearance="outline" subscriptSizing="dynamic">
      <mat-datepicker-toggle matIconPrefix [for]="picker" />
      <input
        matInput
        [id]="id"
        [matDatepicker]="picker"
        [formControl]="control"
        [required]="props().required"
        [placeholder]="props().placeholder ?? 'dd/mm/aaaa'"
        (blur)="sduiEvent.emit({ type: 'blur' })"
      />
      <mat-datepicker #picker />
      <mat-error>{{ props().error }}</mat-error>
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
})
export class DsDateInputComponent implements SduiComponent<SduiViewOf<'input.date'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'input.date'>>();
  readonly sduiEvent = output<SduiUiEvent>();
  protected readonly id = `ds-date-${nextId++}`;
  protected readonly control = new FormControl<Date | null>(null);

  constructor() {
    // No contrato a data trafega como ISO `aaaa-mm-dd`; o Date é detalhe do widget.
    syncControl(this.control, this.props, (event) => this.sduiEvent.emit(event), {
      toControl: (value) => (value ? new Date(`${value}T00:00:00`) : null),
      fromControl: (value) => (value && !Number.isNaN(value.getTime()) ? toIsoDate(value) : null),
    });
  }
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  selector: 'ds-textarea',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-label" [for]="id">
      {{ props().label }}
      @if (props().required) {
        <span class="req" aria-hidden="true">*</span>
      }
    </label>
    <mat-form-field appearance="outline">
      <textarea
        matInput
        [id]="id"
        [formControl]="control"
        [rows]="props().rows ?? 4"
        [required]="props().required"
        [attr.maxlength]="props().maxLength"
        [placeholder]="props().placeholder ?? ''"
        (blur)="sduiEvent.emit({ type: 'blur' })"
      ></textarea>
      @if (props().hint) {
        <mat-hint>{{ props().hint }}</mat-hint>
      }
      @if (props().maxLength; as max) {
        <mat-hint align="end">{{ control.value.length }} / {{ max }}</mat-hint>
      }
      <mat-error>{{ props().error }}</mat-error>
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
})
export class DsTextareaComponent implements SduiComponent<SduiViewOf<'input.textarea'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'input.textarea'>>();
  readonly sduiEvent = output<SduiUiEvent>();
  protected readonly id = `ds-textarea-${nextId++}`;
  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    syncControl(this.control, this.props, (event) => this.sduiEvent.emit(event), AS_STRING);
  }
}

@Component({
  selector: 'ds-select',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ds-label" [id]="labelId">
      {{ props().label }}
      @if (props().required) {
        <span class="req" aria-hidden="true">*</span>
      }
    </span>
    <mat-form-field class="ds-input" appearance="outline" subscriptSizing="dynamic">
      <mat-select
        [formControl]="control"
        [required]="props().required"
        [placeholder]="props().placeholder ?? ''"
        [attr.aria-labelledby]="labelId"
        (openedChange)="$event || sduiEvent.emit({ type: 'blur' })"
      >
        @for (option of props().options; track option.value) {
          <mat-option [value]="option.value">{{ option.label }}</mat-option>
        }
      </mat-select>
      @if (props().hint) {
        <mat-hint>{{ props().hint }}</mat-hint>
      }
      <mat-error>{{ props().error }}</mat-error>
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
})
export class DsSelectComponent implements SduiComponent<SduiViewOf<'input.select'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'input.select'>>();
  readonly sduiEvent = output<SduiUiEvent>();
  protected readonly labelId = `ds-select-${nextId++}`;
  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    syncControl(this.control, this.props, (event) => this.sduiEvent.emit(event), AS_STRING);
  }
}
