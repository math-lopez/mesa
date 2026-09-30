import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { Resolved, SduiConfirm } from '../../core/sdui';

@Component({
  selector: 'ds-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">{{ data.cancelLabel ?? 'Cancelar' }}</button>
      <button
        matButton="filled"
        type="button"
        cdkFocusInitial
        [class.danger]="data.tone === 'danger'"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DsConfirmDialogComponent {
  protected readonly data = inject<Resolved<SduiConfirm>>(MAT_DIALOG_DATA);
}
