import { isDevMode } from '@angular/core';

import { SduiSchemaError, SduiScreen, parseSduiScreen } from '../core/sdui';
import { buildAnaliseScreen } from './analise.template';
import { buildFilaScreen } from './fila.template';
import {
  AnaliseScreen,
  FilaScreen,
  TEMPLATE_CONTRACT_MAJOR,
  TemplateName,
  TemplateScreen,
} from './template-contract.model';

/** Registro de templates: nome no contrato → montador do layout base. */
const TEMPLATES: { readonly [K in TemplateName]: (screen: Extract<TemplateScreen, { template: K }>) => SduiScreen } = {
  fila: buildFilaScreen,
  analise: buildAnaliseScreen,
};

/** Campos de lista obrigatórios por template — validação mínima na fronteira de rede. */
const REQUIRED_LISTS: { readonly [K in TemplateName]: readonly string[] } = {
  fila: ['filtros', 'colunas'] satisfies (keyof FilaScreen)[],
  analise: ['blocos', 'acoes'] satisfies (keyof AnaliseScreen)[],
};

/**
 * Fronteira entre o BFF e o motor: valida o JSON enxuto (v2), escolhe o
 * template e monta a árvore interna que o motor SDUI renderiza.
 */
export function compileTemplateScreen(raw: unknown): SduiScreen {
  if (!isObject(raw)) throw new SduiSchemaError('Resposta da tela vazia ou inválida.');

  const meta = raw['meta'];
  if (!isObject(meta) || typeof meta['schemaVersion'] !== 'string') {
    throw new SduiSchemaError('Tela sem `meta.schemaVersion`.');
  }
  const major = Number.parseInt(meta['schemaVersion'], 10);
  if (major !== TEMPLATE_CONTRACT_MAJOR) {
    throw new SduiSchemaError(
      `Contrato de tela v${meta['schemaVersion']} não suportado (esperado v${TEMPLATE_CONTRACT_MAJOR}.x). Atualize a aplicação.`,
    );
  }

  const template = raw['template'];
  if (typeof template !== 'string' || !Object.hasOwn(TEMPLATES, template)) {
    throw new SduiSchemaError(`Template de tela desconhecido: "${String(template)}".`);
  }
  const name = template as TemplateName;
  const missing = REQUIRED_LISTS[name].filter((key) => !Array.isArray(raw[key]));
  if (missing.length) {
    throw new SduiSchemaError(`Tela "${name}" sem ${missing.map((key) => `\`${key}\``).join(', ')}.`);
  }

  const build = TEMPLATES[name] as (screen: TemplateScreen) => SduiScreen;
  const tree = build(raw as unknown as TemplateScreen);
  // Em dev, confere a árvore montada (ids únicos, nós bem formados).
  return isDevMode() ? parseSduiScreen(tree) : tree;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
