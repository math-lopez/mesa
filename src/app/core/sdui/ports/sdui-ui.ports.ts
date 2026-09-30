import { Resolved, SduiConfirm, SduiTone } from '../models';

/**
 * Portas para interações que não são "um nó na árvore" (modal, toast).
 * O core depende só destas abstrações; o Design System fornece o adapter.
 */
export abstract class SduiDialogPort {
  abstract confirm(options: Resolved<SduiConfirm>): Promise<boolean>;
}

export abstract class SduiNotifierPort {
  abstract notify(message: string, tone?: SduiTone): void;
}
