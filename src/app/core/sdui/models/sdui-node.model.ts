import { Bindable, Resolved, SduiPrimitive, SduiStatePath } from './sdui-binding.model';
import { SduiCondition } from './sdui-condition.model';
import { SduiActionId } from './sdui-action.model';

// ---------------------------------------------------------------------------
// Vocabulário visual compartilhado (agnóstico de Design System)
// ---------------------------------------------------------------------------

export type SduiTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type SduiFormat =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'cpf'
  | 'cnpj'
  /** CPF ou CNPJ, detectado pela quantidade de dígitos. */
  | 'document'
  | 'boolean'
  | 'months';

export interface SduiOption {
  readonly value: string;
  readonly label: string;
}

export type SduiRow = Readonly<Record<string, SduiPrimitive>>;

export interface SduiTableColumn {
  readonly key: string;
  readonly header: string;
  readonly format?: SduiFormat;
  readonly align?: 'start' | 'end';
}

export type SduiButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** Ação exibida em cada linha de uma `data.table`; dispara com `item` = a linha. */
export interface SduiRowAction {
  readonly action: SduiActionId;
  readonly label: string;
  readonly variant?: SduiButtonVariant;
}

export interface SduiDataColumn {
  readonly key: string;
  readonly header: string;
  /** `text` (padrão), `badge` (pílula colorida) ou `actions` (botões por linha). */
  readonly kind?: 'text' | 'badge' | 'actions';
  readonly format?: SduiFormat;
  readonly prefix?: string;
  readonly align?: 'start' | 'end';
  readonly sortable?: boolean;
  /** Para `badge`: campo da linha usado para escolher o tom (default: o próprio `key`). */
  readonly toneKey?: string;
  readonly toneMap?: Readonly<Record<string, SduiTone>>;
  readonly actions?: readonly SduiRowAction[];
}

/** Estado de paginação/ordenação da tabela — vive em `state` e alimenta o data source. */
export interface SduiTableState {
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly sort: { readonly active: string; readonly direction: 'asc' | 'desc' } | null;
}

export interface SduiValidators {
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly messages?: Readonly<Partial<Record<'required' | 'minLength' | 'maxLength', string>>>;
}

// ---------------------------------------------------------------------------
// Catálogo de props por tipo de nó — ÚNICA fonte de verdade do contrato.
// Adicionar um tipo novo = adicionar uma entrada aqui; o compilador então
// obriga a existência do wrapper correspondente no Component Registry.
// ---------------------------------------------------------------------------

export interface SduiPropsCatalog {
  'layout.page': {
    readonly title: Bindable<string>;
    readonly subtitle?: Bindable<string>;
  };
  'layout.section': {
    readonly title: Bindable<string>;
    readonly icon?: string;
    readonly description?: Bindable<string>;
    readonly collapsible?: boolean;
    readonly expanded?: boolean;
  };
  'layout.grid': {
    readonly columns: 1 | 2 | 3 | 4 | 6 | 12;
    /** Alinhamento vertical dos itens (ex.: `end` para botões ao lado de inputs). */
    readonly align?: 'start' | 'center' | 'end';
    readonly gap?: 'sm' | 'md' | 'lg';
  };
  'layout.actionBar': {
    readonly align?: 'start' | 'end' | 'between';
  };
  'display.field': {
    readonly label: string;
    readonly value: Bindable<SduiPrimitive>;
    readonly format?: SduiFormat;
    /** Quantas colunas o campo ocupa dentro de um `layout.grid`. */
    readonly span?: 1 | 2 | 3 | 4;
    readonly emphasis?: boolean;
  };
  'display.badge': {
    readonly label?: string;
    readonly value: Bindable<string>;
    readonly tone?: SduiTone;
    /** Mapeia o valor para um tom (ex.: classificação "A" -> success). */
    readonly toneMap?: Readonly<Record<string, SduiTone>>;
  };
  'display.alert': {
    readonly tone: SduiTone;
    readonly title?: Bindable<string>;
    readonly message: Bindable<string>;
  };
  'display.table': {
    readonly columns: readonly SduiTableColumn[];
    readonly rows: Bindable<readonly SduiRow[]>;
    readonly emptyMessage?: string;
  };
  'input.textarea': {
    readonly label: string;
    readonly placeholder?: string;
    readonly hint?: string;
    readonly rows?: number;
  };
  'input.text': {
    readonly label: string;
    readonly placeholder?: string;
    readonly hint?: string;
    /** Ícone exibido no fim do campo (ex.: `search`). */
    readonly icon?: string;
  };
  'input.date': {
    readonly label: string;
    readonly placeholder?: string;
    readonly hint?: string;
  };
  'input.select': {
    readonly label: string;
    readonly placeholder?: string;
    readonly hint?: string;
    readonly options: Bindable<readonly SduiOption[]>;
  };
  'action.button': {
    readonly label: Bindable<string>;
    readonly icon?: string;
    readonly variant?: SduiButtonVariant;
  };
  'action.counter': {
    readonly label: string;
    readonly count: Bindable<number | null>;
    readonly tone?: SduiTone;
    readonly active?: Bindable<boolean>;
  };
  /** Tabela com paginação/ordenação server-side (dados via data source). */
  'data.table': {
    readonly columns: readonly SduiDataColumn[];
    readonly rows: Bindable<readonly SduiRow[]>;
    readonly total: Bindable<number>;
    readonly loading?: Bindable<boolean>;
    readonly error?: Bindable<string | null>;
    readonly rowKey: string;
    /** Substantivo no rodapé: "Exibindo 1-10 de 45 {itemLabel}". */
    readonly itemLabel?: string;
    readonly emptyMessage?: string;
  };
}

export type SduiNodeType = keyof SduiPropsCatalog;

/** Nós de entrada: fazem two-way com um caminho em `state`. */
export interface SduiFieldBinding {
  readonly bind: SduiStatePath;
  readonly validators?: SduiValidators;
}

/** Nós clicáveis: disparam uma ação do catálogo `actions` da tela. */
export interface SduiEventBinding {
  readonly on: { readonly click: SduiActionId };
}

/** Campos que disparam uma ação ao pressionar Enter (ex.: busca). */
export interface SduiSubmitBinding {
  readonly on?: { readonly submit?: SduiActionId };
}

interface SduiInteractionCatalog {
  'input.text': SduiFieldBinding & SduiSubmitBinding;
  'input.date': SduiFieldBinding;
  'input.textarea': SduiFieldBinding;
  'input.select': SduiFieldBinding;
  'action.button': SduiEventBinding;
  'action.counter': SduiEventBinding;
  'data.table': SduiFieldBinding;
}

export interface SduiNodeBase<TType extends string, TProps> {
  /** Único na tela. Usado como chave de reconciliação e para telemetria/testes. */
  readonly id: string;
  readonly type: TType;
  readonly props: TProps;
  readonly visibleWhen?: SduiCondition;
  /** Dica de posicionamento: colunas ocupadas dentro de um `layout.grid`. */
  readonly span?: number;
  /** Conteúdo padrão de containers. */
  readonly children?: readonly SduiNode[];
  /** Regiões nomeadas (ex.: `header`, `main`, `footer` do `layout.page`). */
  readonly slots?: Readonly<Record<string, readonly SduiNode[]>>;
}

export type SduiNodeOf<T extends SduiNodeType> = SduiNodeBase<T, SduiPropsCatalog[T]> &
  (T extends keyof SduiInteractionCatalog ? SduiInteractionCatalog[T] : unknown);

/** União discriminada por `type` de todos os nós suportados. */
export type SduiNode = { [T in SduiNodeType]: SduiNodeOf<T> }[SduiNodeType];

// ---------------------------------------------------------------------------
// View model: o que o wrapper recebe no input `props`
// ---------------------------------------------------------------------------

/** Estado de campo injetado pelo motor em nós com `bind`. */
export interface SduiFieldRuntime<TValue> {
  readonly value: TValue | null;
  /** Mensagem de erro já pronta para exibição (só após o campo ser tocado). */
  readonly error: string | null;
  readonly required: boolean;
  readonly maxLength: number | null;
}

/** Estado de ação injetado pelo motor em nós com `on.click`. */
export interface SduiActionRuntime {
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly disabledReason: string | null;
}

interface SduiRuntimeCatalog {
  'input.text': SduiFieldRuntime<string>;
  'input.date': SduiFieldRuntime<string>;
  'input.textarea': SduiFieldRuntime<string>;
  'input.select': SduiFieldRuntime<string>;
  'action.button': SduiActionRuntime;
  'action.counter': SduiActionRuntime;
  'data.table': SduiFieldRuntime<SduiTableState>;
}

export type SduiViewOf<T extends SduiNodeType> = Resolved<SduiPropsCatalog[T]> &
  (T extends keyof SduiRuntimeCatalog ? SduiRuntimeCatalog[T] : unknown);

export function isFieldNode(node: SduiNode): node is SduiNode & SduiFieldBinding {
  return 'bind' in node && typeof node.bind === 'string';
}

export function isInteractiveNode(node: SduiNode): node is SduiNode & SduiEventBinding {
  return 'on' in node && typeof (node.on as { click?: unknown } | undefined)?.click === 'string';
}

export function submitActionOf(node: SduiNode): SduiActionId | null {
  const submit = 'on' in node ? (node.on as { submit?: unknown } | undefined)?.submit : undefined;
  return typeof submit === 'string' ? submit : null;
}
