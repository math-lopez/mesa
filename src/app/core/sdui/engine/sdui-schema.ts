import { isDevMode } from '@angular/core';

import { SDUI_SUPPORTED_MAJOR, SduiNode, SduiScreen } from '../models';

export class SduiSchemaError extends Error {
  override readonly name = 'SduiSchemaError';
}

/**
 * Validação estrutural na fronteira de rede. O TypeScript não protege dados
 * vindos do servidor; isto garante o mínimo para o motor não quebrar e
 * rejeita contratos de major incompatível.
 */
export function parseSduiScreen(raw: unknown): SduiScreen {
  if (!isObject(raw)) throw new SduiSchemaError('Resposta SDUI vazia ou inválida.');

  const { meta, data, state, actions, layout, sources } = raw;
  if (!isObject(meta) || typeof meta['schemaVersion'] !== 'string') {
    throw new SduiSchemaError('SDUI sem `meta.schemaVersion`.');
  }
  const major = Number.parseInt(meta['schemaVersion'], 10);
  if (major !== SDUI_SUPPORTED_MAJOR) {
    throw new SduiSchemaError(
      `Contrato SDUI v${meta['schemaVersion']} não suportado (esperado v${SDUI_SUPPORTED_MAJOR}.x). Atualize a aplicação.`,
    );
  }
  if (!isObject(data) || !isObject(state) || !isObject(actions)) {
    throw new SduiSchemaError('SDUI sem `data`, `state` ou `actions`.');
  }
  if (sources !== undefined && !isObject(sources)) {
    throw new SduiSchemaError('SDUI com `sources` inválido.');
  }
  if (!isNode(layout)) throw new SduiSchemaError('SDUI com `layout` inválido.');

  const screen = raw as unknown as SduiScreen;
  if (isDevMode()) assertUniqueIds(screen.layout);
  return screen;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNode(value: unknown): value is SduiNode {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    typeof value['type'] === 'string' &&
    isObject(value['props'])
  );
}

function assertUniqueIds(root: SduiNode): void {
  const seen = new Set<string>();
  const visit = (node: SduiNode): void => {
    if (!isNode(node)) throw new SduiSchemaError(`Nó inválido dentro de "${[...seen].at(-1)}".`);
    if (seen.has(node.id)) throw new SduiSchemaError(`Id de nó duplicado: "${node.id}".`);
    seen.add(node.id);
    node.children?.forEach(visit);
    Object.values(node.slots ?? {}).forEach((slot) => slot.forEach(visit));
  };
  visit(root);
}
