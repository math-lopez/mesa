/** Lógica do "BFF fake" da fila — funções puras, sem Angular, testáveis isoladamente. */

export interface MockProposal {
  readonly id: string;
  readonly cliente: string;
  readonly documento: string;
  readonly produto: string;
  readonly produtoDescricao: string;
  readonly valor: number;
  readonly dataEnvio: string;
  readonly status: 'DISPONIVEL' | 'PENDENTE' | 'URGENTE' | 'EM_ATUACAO';
  readonly statusDescricao: string;
  readonly situacao: 'DISPONIVEL' | 'EM_ATUACAO';
  readonly responsavel: string | null;
}

export interface MockQueueQuery {
  readonly busca?: string | null;
  readonly situacao?: string | null;
  readonly produto?: string | null;
  readonly dataCriacao?: string | null;
  readonly page: number;
  readonly size: number;
  readonly sortBy?: string | null;
  readonly sortDir?: string | null;
}

export interface MockPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
}

const SORTABLE = new Set(['id', 'cliente', 'valor', 'dataEnvio']);

export function queryQueue(all: readonly MockProposal[], query: MockQueueQuery): MockPage<MockProposal> {
  const term = normalize(query.busca ?? '');
  const digits = term.replace(/\D/g, '');

  const filtered = all.filter(
    (p) =>
      (!query.situacao ||
        (query.situacao === 'URGENTE' ? p.status === 'URGENTE' : p.situacao === query.situacao)) &&
      (!query.produto || p.produto === query.produto) &&
      (!query.dataCriacao || localDate(p.dataEnvio) === query.dataCriacao) &&
      (!term ||
        normalize(p.cliente).includes(term) ||
        (digits.length > 0 && (p.id.includes(digits) || p.documento.includes(digits)))),
  );

  const sortBy = query.sortBy && SORTABLE.has(query.sortBy) ? (query.sortBy as keyof MockProposal) : null;
  if (sortBy) {
    const dir = query.sortDir === 'desc' ? -1 : 1;
    filtered.sort((a, b) => compare(a[sortBy], b[sortBy]) * dir);
  }

  const size = Math.min(Math.max(query.size, 1), 100);
  const start = query.page * size;
  return { items: filtered.slice(start, start + size), total: filtered.length, page: query.page, size };
}

export function queueSummary(all: readonly MockProposal[]) {
  return {
    disponiveis: all.filter((p) => p.situacao === 'DISPONIVEL').length,
    emAtuacao: all.filter((p) => p.situacao === 'EM_ATUACAO').length,
    urgentes: all.filter((p) => p.status === 'URGENTE').length,
  };
}

/** Atribui a proposta ao analista (o que o BFF faria ao "Pegar e Atuar"). */
export function assign(proposal: MockProposal, analyst: string): MockProposal {
  return {
    ...proposal,
    situacao: 'EM_ATUACAO',
    status: 'EM_ATUACAO',
    statusDescricao: 'Em atuação',
    responsavel: analyst,
  };
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Data (aaaa-mm-dd) no fuso de São Paulo — o filtro é pela data vista pelo analista. */
function localDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
