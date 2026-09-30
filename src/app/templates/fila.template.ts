import {
  Bindable,
  SduiAction,
  SduiCondition,
  SduiDataColumn,
  SduiNode,
  SduiScreen,
  SduiTableState,
} from '../core/sdui';
import { rowScoped, statePath, toConfirm, toSduiAction } from './template-actions';
import { ColunaFila, FilaScreen, FiltroFila } from './template-contract.model';

/**
 * LAYOUT BASE DA FILA — fixo no front:
 *
 *   ┌ título / subtítulo ─────────────────────────── contadores ┐
 *   ├ card "Filtros de Busca": filtros (largura automática) + Filtrar | Limpar
 *   └ tabela paginada (colunas do BFF + ações por linha)
 *
 * O BFF só informa quais filtros, colunas, contadores e ações existem.
 * Comportamento também é do template: filtros em rascunho × consulta,
 * "Filtrar" volta para a página 1, contador aplica o filtro dele.
 */

const GRID_COLUMNS = 12;
const BUTTONS_SPAN = 3;
const TODOS = { value: '', label: 'Todos' } as const;

const DRAFT = 'filtros.';
const APPLIED = 'consulta.filtros.';
const TABLE: `state.${string}` = 'state.consulta.tabela';

export function buildFilaScreen(screen: FilaScreen): SduiScreen {
  const initial = initialFilters(screen.filtros, true);
  const cleared = initialFilters(screen.filtros, false);
  const table: SduiTableState = {
    pageIndex: 0,
    pageSize: screen.paginacao?.tamanho ?? 10,
    sort: screen.paginacao?.ordenacao
      ? { active: screen.paginacao.ordenacao.campo, direction: screen.paginacao.ordenacao.direcao }
      : null,
  };

  return {
    meta: { ...screen.meta, screenId: 'fila' },
    data: {},
    state: { filtros: initial, consulta: { filtros: initial, tabela: table } },
    sources: {
      fila: {
        endpoint: screen.fonte.listagem,
        params: {
          ...Object.fromEntries(screen.filtros.map((f) => [f.campo, bind(statePath(f.campo, APPLIED))])),
          page: bind(`${TABLE}.pageIndex`),
          size: bind(`${TABLE}.pageSize`),
          sortBy: bind(`${TABLE}.sort.active`),
          sortDir: bind(`${TABLE}.sort.direction`),
        },
      },
      ...(screen.fonte.resumo && { resumo: { endpoint: screen.fonte.resumo } }),
    },
    actions: buildActions(screen, cleared),
    layout: {
      id: 'page',
      type: 'layout.page',
      props: { title: screen.titulo, subtitle: screen.subtitulo },
      slots: {
        toolbar: (screen.contadores ?? []).map((contador, i): SduiNode => ({
          id: `contador-${i}`,
          type: 'action.counter',
          props: {
            label: contador.label,
            tone: contador.tom ?? 'info',
            count: bind(`sources.resumo.value.${contador.chave}`),
            active: { $when: filtersApplied(contador.filtro) },
          },
          on: { click: `CONTADOR_${i}` },
        })),
        main: [filtersSection(screen.filtros), dataTable(screen)],
      },
    },
  };
}

function buildActions(screen: FilaScreen, cleared: Record<string, unknown>): Record<string, SduiAction> {
  const draftValues = Object.fromEntries(
    screen.filtros.map((f) => [f.campo, bind(statePath(f.campo, DRAFT))]),
  );
  return {
    FILTRAR: { kind: 'setState', path: 'state.consulta.filtros', value: bind('state.filtros'), onSuccess: ['PRIMEIRA_PAGINA'] },
    PRIMEIRA_PAGINA: { kind: 'setState', path: `${TABLE}.pageIndex`, value: 0 },
    LIMPAR_FILTROS: { kind: 'setState', path: 'state.filtros', value: cleared, onSuccess: ['FILTRAR'] },
    ...Object.fromEntries(
      (screen.contadores ?? []).map((contador, i) => [
        `CONTADOR_${i}`,
        { kind: 'setState', path: 'state.filtros', value: { ...draftValues, ...contador.filtro }, onSuccess: ['FILTRAR'] },
      ]),
    ),
    ...Object.fromEntries(
      (screen.acoesLinha ?? []).map((acao, i) => [
        `LINHA_${i}`,
        toSduiAction(acao.executa, {
          enabledWhen: acao.campoHabilitado
            ? { op: 'eq', path: `item.${acao.campoHabilitado}`, value: true }
            : undefined,
          disabledReason: acao.motivoBloqueio,
          confirm: toConfirm(acao.confirmacao),
          rewritePath: rowScoped,
        }),
      ]),
    ),
  };
}

function filtersSection(filtros: readonly FiltroFila[]): SduiNode {
  const spans = filtros.map((f) => (f.tipo === 'texto' ? 3 : 2));
  // Botões no fim da última linha; se não couberem, ganham uma linha própria alinhada à direita.
  const lastRow = spans.reduce((row, span) => (row + span > GRID_COLUMNS ? span : row + span), 0);
  const free = GRID_COLUMNS - lastRow;
  const buttonsSpan = free >= BUTTONS_SPAN ? free : GRID_COLUMNS;

  return {
    id: 'secao-filtros',
    type: 'layout.section',
    props: { title: 'Filtros de Busca' },
    children: [
      {
        id: 'grade-filtros',
        type: 'layout.grid',
        props: { columns: 12, align: 'end' },
        children: [
          ...filtros.map((filtro, i) => filterNode(filtro, spans[i]!)),
          {
            id: 'botoes-filtros',
            type: 'layout.actionBar',
            span: buttonsSpan,
            props: { align: buttonsSpan === GRID_COLUMNS ? 'end' : 'start' },
            children: [
              { id: 'filtrar', type: 'action.button', props: { label: 'Filtrar', variant: 'primary' }, on: { click: 'FILTRAR' } },
              { id: 'limpar', type: 'action.button', props: { label: 'Limpar filtros', variant: 'ghost' }, on: { click: 'LIMPAR_FILTROS' } },
            ],
          },
        ],
      },
    ],
  };
}

function filterNode(filtro: FiltroFila, span: number): SduiNode {
  const common = { id: `filtro-${filtro.campo}`, span, bind: statePath(filtro.campo, DRAFT) } as const;
  switch (filtro.tipo) {
    case 'texto':
      return {
        ...common,
        type: 'input.text',
        props: { label: filtro.label, placeholder: filtro.placeholder, icon: filtro.icone ?? 'search' },
        on: { submit: 'FILTRAR' },
      };
    case 'select':
      return {
        ...common,
        type: 'input.select',
        props: {
          label: filtro.label,
          placeholder: filtro.placeholder,
          options: filtro.semOpcaoTodos ? filtro.opcoes : [TODOS, ...filtro.opcoes],
        },
      };
    case 'data':
      return { ...common, type: 'input.date', props: { label: filtro.label, placeholder: filtro.placeholder ?? filtro.label } };
  }
}

function dataTable(screen: FilaScreen): SduiNode {
  const acoes = screen.acoesLinha ?? [];
  const columns: SduiDataColumn[] = [
    ...screen.colunas.map(toColumn),
    ...(acoes.length
      ? [
          {
            key: '__acoes',
            header: 'Ações',
            kind: 'actions' as const,
            actions: acoes.map((acao, i) => ({ action: `LINHA_${i}`, label: acao.label, variant: acao.variante })),
          },
        ]
      : []),
  ];
  return {
    id: 'tabela',
    type: 'data.table',
    bind: TABLE,
    props: {
      rowKey: screen.chaveLinha ?? 'id',
      itemLabel: screen.itens ?? 'registros',
      emptyMessage: screen.mensagemVazia,
      columns,
      rows: { $bind: 'sources.fila.value.items', default: null },
      total: { $bind: 'sources.fila.value.total', default: 0 },
      loading: bind('sources.fila.loading'),
      error: bind('sources.fila.error'),
    },
  };
}

function toColumn(coluna: ColunaFila): SduiDataColumn {
  return {
    key: coluna.campo,
    header: coluna.label,
    kind: coluna.tipo === 'badge' ? 'badge' : 'text',
    format: coluna.formato,
    prefix: coluna.prefixo,
    sortable: coluna.ordenavel,
    align: coluna.alinhamento === 'fim' ? 'end' : 'start',
    toneKey: coluna.campoTom,
    toneMap: coluna.tons,
  };
}

/** `valorInicial` só vale no carregamento; "Limpar" volta para vazio/"Todos". */
function initialFilters(filtros: readonly FiltroFila[], useInitial: boolean): Record<string, unknown> {
  return Object.fromEntries(
    filtros.map((f) => {
      const empty = f.tipo === 'select' && !f.semOpcaoTodos ? '' : null;
      return [f.campo, useInitial ? (f.valorInicial ?? empty) : empty];
    }),
  );
}

function filtersApplied(filtro: Readonly<Record<string, string>>): SduiCondition {
  const conditions = Object.entries(filtro).map(
    ([campo, value]): SduiCondition => ({ op: 'eq', path: statePath(campo, APPLIED), value }),
  );
  return conditions.length === 1 ? conditions[0]! : { op: 'and', conditions };
}

function bind(path: `${'state' | 'sources'}.${string}`): Bindable<never> {
  return { $bind: path };
}
