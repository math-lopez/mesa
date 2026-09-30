import { InjectionToken } from '@angular/core';

import { SduiAction, SduiActionKind, SduiActionResult } from '../models';
import { SduiResolver, SduiScope } from '../engine/sdui-resolver';
import { SduiStore } from '../engine/sdui-store';

/** O que um handler pode usar da tela que disparou a ação. */
export interface SduiActionContext {
  readonly store: SduiStore;
  readonly resolver: SduiResolver;
  /** Contexto do disparo (ex.: `item` = linha da tabela). */
  readonly scope?: SduiScope;
}

export interface SduiActionHandler<TKind extends SduiActionKind = SduiActionKind> {
  readonly kind: TKind;
  execute(
    action: Extract<SduiAction, { kind: TKind }>,
    context: SduiActionContext,
  ): Promise<SduiActionResult | void>;
}

export type AnySduiActionHandler = { [K in SduiActionKind]: SduiActionHandler<K> }[SduiActionKind];

/** Multi-provider: novos `kind` de ação entram sem tocar no dispatcher. */
export const SDUI_ACTION_HANDLERS = new InjectionToken<readonly AnySduiActionHandler[]>(
  'SDUI_ACTION_HANDLERS',
);
