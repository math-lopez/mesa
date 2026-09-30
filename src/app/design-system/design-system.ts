import { SduiDesignSystem } from '../core/sdui';
import { MaterialDialogAdapter, MaterialNotifierAdapter } from './adapters/material-ui.adapters';
import { DS_COMPONENT_MAP } from './ds-component-map';

/** Implementação atual do Design System (Angular Material). Ponto único de troca. */
export const DESIGN_SYSTEM: SduiDesignSystem = {
  components: DS_COMPONENT_MAP,
  dialog: MaterialDialogAdapter,
  notifier: MaterialNotifierAdapter,
};
