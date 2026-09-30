import { InjectionToken } from '@angular/core';

import { SduiNode } from '../models';

/**
 * O nó JSON que originou o componente. Fornecido num injector próprio de cada
 * componente criado — é por ele que `sduiSlot` encontra os filhos do container.
 */
export const SDUI_NODE = new InjectionToken<SduiNode>('SDUI_NODE');
