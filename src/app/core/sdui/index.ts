// API pública do core SDUI. Features e Design System importam só daqui.
export * from './models';
export { SDUI_ACTION_HANDLERS } from './actions/sdui-action-handler';
export type { SduiActionContext, SduiActionHandler } from './actions/sdui-action-handler';
export { SduiScreenComponent } from './engine/sdui-screen.component';
export { SduiSlotDirective } from './engine/sdui-renderer';
export { SduiSchemaError, parseSduiScreen } from './engine/sdui-schema';
export { SduiFormatPipe, formatSduiValue, resolveTone } from './format/sdui-format';
export { SduiDialogPort, SduiNotifierPort } from './ports/sdui-ui.ports';
export type { SduiComponentMap, SduiComponentType } from './registry/sdui-component-registry';
export { provideSdui } from './provide-sdui';
export type { SduiDesignSystem } from './provide-sdui';
