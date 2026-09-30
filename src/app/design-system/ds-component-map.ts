import { SduiComponentMap } from '../core/sdui';

/**
 * DE-PARA: `type` do contrato SDUI  →  wrapper do Design System.
 *
 * - Lazy: cada entrada é um `import()` — o wrapper só é baixado se a tela usar.
 * - Tipado: `SduiComponentMap` exige TODAS as chaves do catálogo e confere que
 *   o `props` de cada wrapper é compatível com o contrato daquele `type`.
 *
 * Migração para o DS corporativo: reescreva o template/SCSS interno dos
 * wrappers em `./components`, OU aponte estas entradas para novos wrappers.
 * O motor, o JSON e as telas não mudam.
 */
export const DS_COMPONENT_MAP: SduiComponentMap = {
  'layout.page': () => import('./components/ds-page.component').then((m) => m.DsPageComponent),
  'layout.section': () => import('./components/ds-section.component').then((m) => m.DsSectionComponent),
  'layout.grid': () => import('./components/ds-layout.components').then((m) => m.DsGridComponent),
  'layout.actionBar': () => import('./components/ds-layout.components').then((m) => m.DsActionBarComponent),
  'display.field': () => import('./components/ds-display.components').then((m) => m.DsFieldComponent),
  'display.badge': () => import('./components/ds-display.components').then((m) => m.DsBadgeComponent),
  'display.alert': () => import('./components/ds-display.components').then((m) => m.DsAlertComponent),
  'display.table': () => import('./components/ds-table.component').then((m) => m.DsTableComponent),
  'input.text': () => import('./components/ds-inputs.components').then((m) => m.DsTextInputComponent),
  'input.date': () => import('./components/ds-inputs.components').then((m) => m.DsDateInputComponent),
  'input.textarea': () => import('./components/ds-inputs.components').then((m) => m.DsTextareaComponent),
  'input.select': () => import('./components/ds-inputs.components').then((m) => m.DsSelectComponent),
  'action.button': () => import('./components/ds-button.component').then((m) => m.DsButtonComponent),
  'action.counter': () => import('./components/ds-counter.component').then((m) => m.DsCounterComponent),
  'data.table': () => import('./components/ds-data-table.component').then((m) => m.DsDataTableComponent),
};
