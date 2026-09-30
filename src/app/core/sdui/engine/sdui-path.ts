/** Utilitários puros de leitura/escrita imutável por caminho com pontos (`a.b.0.c`). */

export function splitPath(path: string): readonly string[] {
  return path.split('.').filter((segment) => segment.length > 0);
}

export function readPath(source: unknown, segments: readonly string[]): unknown {
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Retorna uma cópia de `source` com `value` gravado no caminho, clonando só o trecho alterado. */
export function writePath<T>(source: T, segments: readonly string[], value: unknown): T {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return value as T;
  }
  const container: unknown = source ?? {};
  const child = (container as Record<string, unknown>)[head];
  const next = rest.length === 0 ? value : writePath(child, rest, value);

  if (Array.isArray(container)) {
    const copy = [...container];
    copy[Number(head)] = next;
    return copy as T;
  }
  return { ...(container as object), [head]: next } as T;
}
