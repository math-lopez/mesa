import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/** Estados de carregamento/erro de página (fora da árvore SDUI). */
@Component({
  selector: 'ds-feedback',
  imports: [MatProgressBarModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <div role="status" aria-live="polite">
          <mat-progress-bar mode="indeterminate" />
          <p>{{ message() ?? 'Carregando…' }}</p>
        </div>
      }
      @case ('error') {
        <div role="alert" class="error">
          <p>{{ message() ?? 'Algo deu errado.' }}</p>
          <button matButton="outlined" type="button" (click)="retry.emit()">Tentar novamente</button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 32px;
    }
    .error {
      display: grid;
      gap: 12px;
      justify-items: start;
      color: var(--mat-sys-error);
    }
  `,
})
export class DsFeedbackComponent {
  readonly state = input.required<'loading' | 'error'>();
  readonly message = input<string>();
  readonly retry = output<void>();
}
