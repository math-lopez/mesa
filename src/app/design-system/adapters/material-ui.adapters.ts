import { Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Resolved, SduiConfirm, SduiDialogPort, SduiNotifierPort, SduiTone } from '../../core/sdui';

/**
 * Adapters das portas de UI do motor SDUI para o Angular Material.
 * Dialog e SnackBar são importados sob demanda para ficarem fora do bundle inicial.
 */
@Injectable({ providedIn: 'root' })
export class MaterialDialogAdapter extends SduiDialogPort {
  readonly #injector = inject(Injector);

  override async confirm(options: Resolved<SduiConfirm>): Promise<boolean> {
    const [{ MatDialog }, { DsConfirmDialogComponent }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./ds-confirm-dialog.component'),
    ]);
    const ref = this.#injector.get(MatDialog).open(DsConfirmDialogComponent, {
      data: options,
      width: '440px',
      autoFocus: 'dialog',
      role: 'alertdialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}

@Injectable({ providedIn: 'root' })
export class MaterialNotifierAdapter extends SduiNotifierPort {
  readonly #injector = inject(Injector);

  override notify(message: string, tone: SduiTone = 'neutral'): void {
    void import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
      this.#injector.get(MatSnackBar).open(message, 'Fechar', {
        duration: tone === 'danger' ? 8000 : 4000,
        panelClass: `ds-snackbar--${tone}`,
        politeness: tone === 'danger' ? 'assertive' : 'polite',
      }),
    );
  }
}
