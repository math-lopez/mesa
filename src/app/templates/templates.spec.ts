import { SduiHttpAction, SduiNode, SduiScreen, SduiSetStateAction } from '../core/sdui';
import { buildAnaliseScreen } from './analise.template';
import { buildFilaScreen } from './fila.template';
import { AnaliseScreen, FilaScreen, FiltroFila } from './template-contract.model';

const meta = { schemaVersion: '2.0', product: 'TESTE', revision: 'r', generatedAt: '' };

function find(screen: SduiScreen, id: string): SduiNode {
  const walk = (node: SduiNode): SduiNode | undefined =>
    node.id === id
      ? node
      : [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()].map(walk).find(Boolean);
  const found = walk(screen.layout);
  if (!found) throw new Error(`nó ${id} não encontrado`);
  return found;
}

const fila = (filtros: FiltroFila[], extra: Partial<FilaScreen> = {}): FilaScreen => ({
  meta,
  template: 'fila',
  titulo: 'Fila',
  fonte: { listagem: '/v1/itens', resumo: '/v1/itens/resumo' },
  filtros,
  colunas: [{ campo: 'id', label: 'ID' }],
  ...extra,
});

const texto: FiltroFila = { campo: 'busca', tipo: 'texto', label: 'Busca' };
const select = (campo: string): FiltroFila => ({ campo, tipo: 'select', label: campo, opcoes: [{ value: 'A', label: 'A' }] });

describe('template "fila"', () => {
  it('distribui a largura dos filtros e mantém os botões na mesma linha quando cabem', () => {
    const screen = buildFilaScreen(fila([texto, select('a'), select('b'), select('c')]));
    expect(find(screen, 'filtro-busca').span).toBe(3);
    expect(find(screen, 'filtro-a').span).toBe(2);
    expect(find(screen, 'botoes-filtros').span).toBe(3);
  });

  it('se não sobra espaço na linha, os botões vão para uma linha própria à direita', () => {
    // 3 + 2 + 2 + 2 + 2 = 11 colunas → sobra 1, menos que os 3 dos botões
    const screen = buildFilaScreen(fila([texto, select('a'), select('b'), select('c'), select('d')]));
    const botoes = find(screen, 'botoes-filtros');
    expect(botoes.span).toBe(12);
    expect(botoes.props).toMatchObject({ align: 'end' });
  });

  it('filtros que passam de uma linha quebram, e os botões ocupam o resto da última', () => {
    // 3+2+2+2 = 9 | +2 = 11 | +2 estoura → nova linha com 2 → botões ficam com 10
    const screen = buildFilaScreen(fila([texto, select('a'), select('b'), select('c'), select('d'), select('e')]));
    expect(find(screen, 'botoes-filtros').span).toBe(10);
  });

  it('acrescenta "Todos" nos selects e usa o valor inicial só na carga', () => {
    const screen = buildFilaScreen(fila([{ ...select('situacao'), valorInicial: 'A' } as FiltroFila]));
    expect((find(screen, 'filtro-situacao').props as { options: unknown[] }).options[0]).toEqual({ value: '', label: 'Todos' });
    expect(screen.state).toMatchObject({ filtros: { situacao: 'A' } });
    expect((screen.actions['LIMPAR_FILTROS'] as SduiSetStateAction).value).toEqual({ situacao: '' });
  });

  it('envia cada filtro aplicado como parâmetro da listagem, com paginação/ordenação', () => {
    const screen = buildFilaScreen(
      fila([texto], { paginacao: { tamanho: 20, ordenacao: { campo: 'valor', direcao: 'asc' } } }),
    );
    expect(Object.keys(screen.sources!['fila']!.params!)).toEqual(['busca', 'page', 'size', 'sortBy', 'sortDir']);
    expect(screen.state).toMatchObject({ consulta: { tabela: { pageSize: 20, sort: { active: 'valor', direction: 'asc' } } } });
  });

  it('contador aplica o próprio filtro preservando os demais e fica ativo quando aplicado', () => {
    const screen = buildFilaScreen(
      fila([texto, select('situacao')], {
        contadores: [{ label: 'Urgentes', chave: 'urgentes', filtro: { situacao: 'URGENTE' } }],
      }),
    );
    expect(screen.actions['CONTADOR_0']).toMatchObject({
      kind: 'setState',
      path: 'state.filtros',
      value: { busca: { $bind: 'state.filtros.busca' }, situacao: 'URGENTE' },
      onSuccess: ['FILTRAR'],
    });
    expect(find(screen, 'contador-0').props).toMatchObject({
      count: { $bind: 'sources.resumo.value.urgentes' },
      active: { $when: { op: 'eq', path: 'state.consulta.filtros.situacao', value: 'URGENTE' } },
    });
  });

  it('ações de linha usam os campos da linha e a permissão calculada pelo BFF', () => {
    const screen = buildFilaScreen(
      fila([texto], {
        acoesLinha: [
          {
            label: 'Pegar',
            campoHabilitado: 'podePegar',
            motivoBloqueio: 'Já em atuação',
            executa: { tipo: 'requisicao', metodo: 'POST', endpoint: '/v1/itens/{id}/atribuicao' },
          },
        ],
      }),
    );
    expect(screen.actions['LINHA_0']).toMatchObject({
      kind: 'http',
      endpoint: '/v1/itens/{item.id}/atribuicao',
      enabledWhen: { op: 'eq', path: 'item.podePegar', value: true },
      disabledReason: 'Já em atuação',
    });
  });
});

const analise = (extra: Partial<AnaliseScreen> = {}): AnaliseScreen => ({
  meta,
  template: 'analise',
  titulo: 'Proposta 1',
  blocos: [{ id: 'dados', tipo: 'campos', titulo: 'Dados', campos: [{ label: 'Nome', valor: 'Ana', largo: true }] }],
  formulario: {
    titulo: 'Parecer',
    campos: [
      { campo: 'parecer', tipo: 'textarea', label: 'Parecer', obrigatorio: true },
      { campo: 'motivo', tipo: 'select', label: 'Motivo', opcoes: [] },
    ],
  },
  acoes: [],
  ...extra,
});

describe('template "analise"', () => {
  it('monta blocos na ordem, com campos largos e formulário no fim', () => {
    const screen = buildAnaliseScreen(analise());
    const main = screen.layout.slots!['main']!.map((node) => node.id);
    expect(main).toEqual(['bloco-dados', 'formulario']);
    expect(find(screen, 'dados-campo-0').span).toBe(2);
    expect(find(screen, 'campo-parecer')).toMatchObject({ bind: 'state.parecer', validators: { required: true } });
  });

  it('traduz as regras da ação: permissão, validação, preenchimento exigido e corpo', () => {
    const screen = buildAnaliseScreen(
      analise({
        acoes: [
          {
            id: 'DEVOLVER',
            label: 'Devolver',
            exigePreenchidos: ['motivo'],
            validar: ['parecer', 'motivo'],
            executa: { tipo: 'requisicao', metodo: 'POST', endpoint: '/v1/p/1/devolver' },
          },
          {
            id: 'APROVAR',
            label: 'Aprovar',
            habilitada: false,
            motivoBloqueio: 'Fora da alçada',
            executa: { tipo: 'requisicao', metodo: 'POST', endpoint: '/v1/p/1/aprovar', enviar: ['parecer'] },
          },
        ],
      }),
    );
    const devolver = screen.actions['DEVOLVER'] as SduiHttpAction;
    expect(devolver.enabledWhen).toEqual({ op: 'exists', path: 'state.motivo' });
    expect(devolver.validate).toEqual(['state.parecer', 'state.motivo']);
    expect(devolver.payload).toEqual({ parecer: { $bind: 'state.parecer' }, motivo: { $bind: 'state.motivo' } });

    const aprovar = screen.actions['APROVAR'] as SduiHttpAction;
    expect(aprovar).toMatchObject({ enabled: false, disabledReason: 'Fora da alçada' });
    expect(aprovar.payload).toEqual({ parecer: { $bind: 'state.parecer' } });
    expect(find(screen, 'acao-APROVAR')).toMatchObject({ on: { click: 'APROVAR' } });
  });
});
