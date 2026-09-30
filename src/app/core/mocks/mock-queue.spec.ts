import { MockProposal, MockViewer, assign, queryQueue, queueSummary } from './mock-queue';

const base: MockProposal = {
  id: '1',
  produto: 'CREDITO_VAREJO',
  produtoDescricao: 'Capital de Giro',
  cliente: 'Cliente',
  documento: '00000000000',
  segmento: 'PF',
  valor: 100,
  dataEnvio: '2026-09-29T13:00:00.000Z',
  status: 'DISPONIVEL',
  statusDescricao: 'Disponível',
  situacao: 'DISPONIVEL',
  responsavel: null,
};

const items: MockProposal[] = [
  { ...base, id: '948372', cliente: 'Ana Paula de Souza', documento: '52998224725', valor: 45500 },
  { ...base, id: '948373', cliente: 'Silva & Santos Ltda', documento: '12345678000190', segmento: 'PJ', valor: 150000 },
  { ...base, id: '948374', cliente: 'João Pedro', valor: 320000, status: 'URGENTE', dataEnvio: '2026-09-28T02:00:00.000Z' },
  assign({ ...base, id: '948375', cliente: 'Beatriz Lima', valor: 9000 }, 'Maria Silva'),
  assign({ ...base, id: '948376', cliente: 'Outro Analista' }, 'Pedro Costa'),
  { ...base, id: '950000', produto: 'VEICULOS', cliente: 'Rafael Prado', placa: 'FJK-4B21', loja: 'Rede Motors' },
  { ...base, id: '960000', produto: 'CONSORCIO', cliente: 'Carlos Batista', grupoCota: '7731/0142' },
];

const maria: MockViewer = { nome: 'Maria Silva', produtos: ['CREDITO_VAREJO'] };
const q = { page: 0, size: 10 };
const ids = (viewer: MockViewer, query: Parameters<typeof queryQueue>[2]) =>
  queryQueue(items, viewer, query).items.map((p) => p.id);

describe('mock da fila (BFF fake)', () => {
  it('restringe às mesas do usuário, mesmo que o front peça outro produto', () => {
    expect(queryQueue(items, maria, q).total).toBe(5);
    expect(queryQueue(items, maria, { ...q, produto: 'VEICULOS' }).total).toBe(0);
    const supervisor = { nome: 'Ricardo', produtos: ['CREDITO_VAREJO', 'VEICULOS'] };
    expect(queryQueue(items, supervisor, q).total).toBe(6);
  });

  it('"em minha atuação" considera o analista do token', () => {
    expect(ids(maria, { ...q, situacao: 'EM_ATUACAO' })).toEqual(['948375']);
    expect(ids(maria, { ...q, situacao: 'URGENTE' })).toEqual(['948374']);
    expect(queryQueue(items, maria, { ...q, situacao: 'DISPONIVEL' }).total).toBe(3);
  });

  it('aplica filtros específicos da mesa (whitelist) e ignora os desconhecidos', () => {
    expect(ids(maria, { ...q, extras: { segmento: 'PJ' } })).toEqual(['948373']);
    expect(queryQueue(items, maria, { ...q, extras: { responsavel: 'x' } }).total).toBe(5);
    const carlos = { nome: 'Carlos', produtos: ['VEICULOS'] };
    expect(ids(carlos, { ...q, extras: { loja: 'Rede Motors' } })).toEqual(['950000']);
  });

  it('busca por nome sem acento, ID, CPF/CNPJ, placa e grupo/cota', () => {
    expect(ids(maria, { ...q, busca: 'joao' })).toEqual(['948374']);
    expect(ids(maria, { ...q, busca: '#948373' })).toEqual(['948373']);
    expect(ids(maria, { ...q, busca: '529.982.247-25' })).toEqual(['948372']);
    expect(ids({ nome: 'C', produtos: ['VEICULOS'] }, { ...q, busca: 'fjk4b' })).toEqual(['950000']);
    expect(ids({ nome: 'F', produtos: ['CONSORCIO'] }, { ...q, busca: '7731/0142' })).toEqual(['960000']);
  });

  it('filtra pela data local (America/Sao_Paulo)', () => {
    // 2026-09-28T02:00Z = 27/09 23:00 em São Paulo
    expect(ids(maria, { ...q, dataCriacao: '2026-09-27' })).toEqual(['948374']);
  });

  it('ordena e pagina no servidor', () => {
    const page = queryQueue(items, maria, { page: 1, size: 2, sortBy: 'valor', sortDir: 'desc' });
    expect(page.total).toBe(5);
    expect(page.items.map((p) => p.valor)).toEqual([45500, 9000]);
  });

  it('calcula os contadores no escopo do usuário', () => {
    expect(queueSummary(items, maria)).toEqual({ disponiveis: 3, emAtuacao: 1, urgentes: 1 });
  });
});
