/** Lógica do "BFF fake" da fila — funções puras, sem Angular, testáveis isoladamente. */

export interface MockProposal {
  readonly id: string;
  readonly produto: string;
  readonly produtoDescricao: string;
  readonly cliente: string;
  readonly documento: string;
  readonly segmento: 'PF' | 'PJ';
  readonly valor: number;
  readonly dataEnvio: string;
  readonly status: 'DISPONIVEL' | 'PENDENTE' | 'URGENTE' | 'EM_ATUACAO';
  readonly statusDescricao: string;
  readonly situacao: 'DISPONIVEL' | 'EM_ATUACAO';
  readonly responsavel: string | null;
  // Campos específicos de produto (presentes só no produto correspondente)
  readonly modalidade?: string;
  readonly veiculo?: string;
  readonly placa?: string | null;
  readonly tipoVeiculo?: string;
  readonly loja?: string;
  readonly grupoCota?: string;
  readonly tipoBem?: string;
  readonly bemDescricao?: string;
  readonly contemplacao?: string;
  readonly contemplacaoDescricao?: string;
}

/** Quem está consultando — o BFF deriva isto do token, nunca de parâmetros do front. */
export interface MockViewer {
  readonly nome: string;
  readonly produtos: readonly string[];
}

export interface MockQueueQuery {
  readonly busca?: string | null;
  readonly situacao?: string | null;
  readonly produto?: string | null;
  readonly dataCriacao?: string | null;
  /** Filtros de igualdade específicos de cada mesa (modalidade, loja, tipoBem...). */
  readonly extras?: Readonly<Record<string, string | null>>;
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

/** Campos que cada mesa pode filtrar por igualdade (whitelist — nada de filtro arbitrário). */
export const EXTRA_FILTERS = ['modalidade', 'segmento', 'tipoVeiculo', 'loja', 'tipoBem', 'contemplacao'] as const;

const SORTABLE = new Set(['id', 'cliente', 'valor', 'dataEnvio', 'veiculo', 'grupoCota']);

/** Escopo de segurança: só propostas dos produtos das mesas do usuário. */
export function visibleTo(all: readonly MockProposal[], viewer: MockViewer): MockProposal[] {
  return all.filter((p) => viewer.produtos.includes(p.produto));
}

export function queryQueue(
  all: readonly MockProposal[],
  viewer: MockViewer,
  query: MockQueueQuery,
): MockPage<MockProposal> {
  const term = normalize(query.busca ?? '');
  const digits = term.replace(/\D/g, '');
  const extras = Object.entries(query.extras ?? {}).filter(
    (entry): entry is [string, string] => !!entry[1] && (EXTRA_FILTERS as readonly string[]).includes(entry[0]),
  );

  const filtered = visibleTo(all, viewer).filter(
    (p) =>
      matchesSituacao(p, query.situacao, viewer) &&
      (!query.produto || p.produto === query.produto) &&
      (!query.dataCriacao || localDate(p.dataEnvio) === query.dataCriacao) &&
      extras.every(([key, value]) => p[key as keyof MockProposal] === value) &&
      (!term || matchesSearch(p, term, digits)),
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

export function queueSummary(all: readonly MockProposal[], viewer: MockViewer) {
  const scoped = visibleTo(all, viewer);
  return {
    disponiveis: scoped.filter((p) => p.situacao === 'DISPONIVEL').length,
    emAtuacao: scoped.filter((p) => matchesSituacao(p, 'EM_ATUACAO', viewer)).length,
    urgentes: scoped.filter((p) => p.status === 'URGENTE').length,
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

function matchesSituacao(p: MockProposal, situacao: string | null | undefined, viewer: MockViewer): boolean {
  switch (situacao) {
    case 'URGENTE':
      return p.status === 'URGENTE';
    case 'EM_ATUACAO': // "em MINHA atuação"
      return p.situacao === 'EM_ATUACAO' && p.responsavel === viewer.nome;
    case 'DISPONIVEL':
      return p.situacao === 'DISPONIVEL';
    default:
      return true;
  }
}

function matchesSearch(p: MockProposal, term: string, digits: string): boolean {
  const compact = term.replace(/[^a-z0-9]/g, '');
  return (
    normalize(p.cliente).includes(term) ||
    (digits.length > 0 && (p.id.includes(digits) || p.documento.includes(digits))) ||
    (!!p.placa && compact.length >= 3 && normalize(p.placa).replace(/[^a-z0-9]/g, '').includes(compact)) ||
    (!!p.grupoCota && p.grupoCota.includes(term))
  );
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true });
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Data (aaaa-mm-dd) no fuso de São Paulo — o filtro é pela data vista pelo analista. */
function localDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
