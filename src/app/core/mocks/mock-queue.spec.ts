import { MockProposal, assign, queryQueue, queueSummary } from './mock-queue';

const base: MockProposal = {
  id: '1',
  cliente: 'Cliente',
  documento: '00000000000',
  produto: 'CREDITO_VAREJO',
  produtoDescricao: 'Capital de Giro',
  valor: 100,
  dataEnvio: '2026-09-29T13:00:00.000Z',
  status: 'DISPONIVEL',
  statusDescricao: 'Disponível',
  situacao: 'DISPONIVEL',
  responsavel: null,
};

const items: MockProposal[] = [
  { ...base, id: '948372', cliente: 'Ana Paula de Souza', documento: '52998224725', valor: 45500 },
  { ...base, id: '948373', cliente: 'Silva & Santos Ltda', documento: '12345678000190', valor: 150000, produto: 'VEICULOS' },
  { ...base, id: '948374', cliente: 'João Pedro', valor: 320000, status: 'URGENTE', dataEnvio: '2026-09-28T02:00:00.000Z' },
  assign({ ...base, id: '948375', cliente: 'Beatriz Lima', valor: 9000 }, 'Maria Silva'),
];

const query = { page: 0, size: 10 };

describe('mock da fila (BFF fake)', () => {
  it('filtra por situação, urgência e produto', () => {
    expect(queryQueue(items, { ...query, situacao: 'DISPONIVEL' }).total).toBe(3);
    expect(queryQueue(items, { ...query, situacao: 'EM_ATUACAO' }).items.map((p) => p.id)).toEqual(['948375']);
    expect(queryQueue(items, { ...query, situacao: 'URGENTE' }).items.map((p) => p.id)).toEqual(['948374']);
    expect(queryQueue(items, { ...query, produto: 'VEICULOS' }).total).toBe(1);
  });

  it('busca por nome sem acento, ID e CPF/CNPJ formatado', () => {
    expect(queryQueue(items, { ...query, busca: 'joao' }).items[0]?.id).toBe('948374');
    expect(queryQueue(items, { ...query, busca: '#948373' }).items[0]?.id).toBe('948373');
    expect(queryQueue(items, { ...query, busca: '529.982.247-25' }).items[0]?.id).toBe('948372');
  });

  it('filtra pela data local (America/Sao_Paulo)', () => {
    // 2026-09-28T02:00Z = 27/09 23:00 em São Paulo
    expect(queryQueue(items, { ...query, dataCriacao: '2026-09-27' }).items.map((p) => p.id)).toEqual(['948374']);
  });

  it('ordena e pagina no servidor', () => {
    const page = queryQueue(items, { page: 1, size: 2, sortBy: 'valor', sortDir: 'desc' });
    expect(page.total).toBe(4);
    expect(page.items.map((p) => p.valor)).toEqual([45500, 9000]);
  });

  it('ignora ordenação por campo não permitido', () => {
    expect(queryQueue(items, { ...query, sortBy: 'responsavel' }).items[0]?.id).toBe('948372');
  });

  it('calcula os contadores', () => {
    expect(queueSummary(items)).toEqual({ disponiveis: 3, emAtuacao: 1, urgentes: 1 });
  });
});
