import { EnvironmentProviders, Provider, Type, makeEnvironmentProviders } from '@angular/core';

import { SDUI_ACTION_HANDLERS } from './actions/sdui-action-handler';
import {
  SduiHttpActionHandler,
  SduiNavigateActionHandler,
  SduiNotifyActionHandler,
  SduiSetStateActionHandler,
} from './actions/sdui-action-handlers';
import { SduiDialogPort, SduiNotifierPort } from './ports/sdui-ui.ports';
import { SduiComponentMap, provideSduiComponents } from './registry/sdui-component-registry';

/**
 * Tudo que um Design System precisa entregar para plugar no motor SDUI.
 * Trocar Material pelo DS corporativo = fornecer outro objeto deste tipo.
 */
export interface SduiDesignSystem {
  readonly components: SduiComponentMap;
  readonly dialog: Type<SduiDialogPort>;
  readonly notifier: Type<SduiNotifierPort>;
}

export function provideSdui(designSystem: SduiDesignSystem): EnvironmentProviders {
  const handlers: Provider[] = [
    SduiHttpActionHandler,
    SduiNavigateActionHandler,
    SduiNotifyActionHandler,
    SduiSetStateActionHandler,
  ].map((handler) => ({ provide: SDUI_ACTION_HANDLERS, useExisting: handler, multi: true }));

  return makeEnvironmentProviders([
    provideSduiComponents(designSystem.components),
    { provide: SduiDialogPort, useClass: designSystem.dialog },
    { provide: SduiNotifierPort, useClass: designSystem.notifier },
    ...handlers,
  ]);
}
