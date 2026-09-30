import { SduiCondition, SduiPath } from '../models';

export type SduiPathReader = (path: SduiPath) => unknown;

/** Avalia a AST de condição. Função pura: reatividade vem de quem chama dentro de um `computed`. */
export function evaluateCondition(condition: SduiCondition, read: SduiPathReader): boolean {
  switch (condition.op) {
    case 'eq':
      return read(condition.path) === condition.value;
    case 'neq':
      return read(condition.path) !== condition.value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumber(read(condition.path), condition.op, condition.value);
    case 'in':
      return condition.values.includes(read(condition.path) as never);
    case 'exists':
      return !isEmpty(read(condition.path));
    case 'empty':
      return isEmpty(read(condition.path));
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, read));
    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, read));
    case 'not':
      return !evaluateCondition(condition.condition, read);
  }
}

function compareNumber(actual: unknown, op: 'gt' | 'gte' | 'lt' | 'lte', expected: number): boolean {
  if (typeof actual !== 'number' || Number.isNaN(actual)) {
    return false;
  }
  switch (op) {
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
  }
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
