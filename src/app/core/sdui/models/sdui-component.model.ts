import { InputSignal, OutputEmitterRef } from '@angular/core';

import type { SduiActionId } from './sdui-action.model';
import type { SduiRow } from './sdui-node.model';

/**
 * Contrato que TODO wrapper do Design System implementa para ser renderizado
 * pelo motor. O wrapper não conhece JSON, store nem ações: recebe `props` já
 * resolvidas e, se for interativo, emite eventos de UI genéricos.
 */
export interface SduiComponent<TView> {
  readonly props: InputSignal<TView>;
}

export type SduiUiEvent =
  | { readonly type: 'click' }
  | { readonly type: 'change'; readonly value: unknown }
  | { readonly type: 'blur' }
  /** Enter num campo: dispara `on.submit` do nó. */
  | { readonly type: 'submit' }
  /** Ação de uma linha de tabela: dispara `action` com `item` = linha. */
  | { readonly type: 'rowAction'; readonly action: SduiActionId; readonly item: SduiRow };

export interface SduiEventEmitter {
  readonly sduiEvent: OutputEmitterRef<SduiUiEvent>;
}
