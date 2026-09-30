import {
  SduiButtonVariant,
  SduiFormat,
  SduiOption,
  SduiPrimitive,
  SduiRow,
  SduiTone,
} from '../core/sdui';

/**
 * CONTRATO DO BFF (v2) — telas por TEMPLATE.
 *
 * O BFF diz O QUE aparece (filtros, colunas, blocos, campos, ações); o front
 * é dono de COMO aparece (layout base de cada template, grid, larguras,
 * posição dos botões). Mais itens ou menos itens não exigem deploy do front;
 * uma disposição nova exige um template novo.
 */

/** Major suportado. Mudança incompatível no contrato = novo major. */
export const TEMPLATE_CONTRACT_MAJOR = 2;

export interface TemplateMeta {
  /** SemVer do contrato (`2.0`, `2.1`...). */
  readonly schemaVersion: string;
  /** Produto/mesa que determinou o conteúdo (`VEICULOS`, `MULTIPLAS`...). */
  readonly product: string;
  /** Versão da parametrização — cache, auditoria, A/B. */
  readonly revision: string;
  readonly generatedAt: string;
  readonly traceId?: string;
}

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

export interface Etiqueta {
  readonly texto: string;
  readonly tom?: SduiTone;
}

export interface Alerta {
  readonly tom: SduiTone;
  readonly titulo?: string;
  readonly mensagem: string;
}

export interface Confirmacao {
  readonly titulo: string;
  readonly mensagem: string;
  /** Texto do botão de confirmar (padrão: "Confirmar"). */
  readonly botao?: string;
  readonly tom?: SduiTone;
}

/** O que um botão executa. Endpoints são relativos ao BFF. */
export type Execucao =
  | {
      readonly tipo: 'requisicao';
      readonly metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      readonly endpoint: string;
      /** Campos do formulário enviados no corpo (padrão: todos). */
      readonly enviar?: readonly string[];
    }
  | { readonly tipo: 'navegacao'; readonly rota: string };

// ---------------------------------------------------------------------------
// Template "fila"
// ---------------------------------------------------------------------------

interface FiltroBase {
  /** Nome do filtro — também é o nome do parâmetro enviado à listagem. */
  readonly campo: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly valorInicial?: string | null;
}

export type FiltroFila =
  | (FiltroBase & { readonly tipo: 'texto'; readonly icone?: string })
  | (FiltroBase & {
      readonly tipo: 'select';
      readonly opcoes: readonly SduiOption[];
      /** Por padrão o template acrescenta a opção "Todos" (valor vazio). */
      readonly semOpcaoTodos?: boolean;
    })
  | (FiltroBase & { readonly tipo: 'data' });

export interface ColunaFila {
  readonly campo: string;
  readonly label: string;
  /** `texto` (padrão) ou `badge` (pílula colorida). */
  readonly tipo?: 'texto' | 'badge';
  readonly formato?: SduiFormat;
  readonly prefixo?: string;
  readonly ordenavel?: boolean;
  readonly alinhamento?: 'inicio' | 'fim';
  /** Para `badge`: campo da linha que define o tom e o mapa valor → tom. */
  readonly campoTom?: string;
  readonly tons?: Readonly<Record<string, SduiTone>>;
}

export interface ContadorFila {
  readonly label: string;
  readonly tom?: SduiTone;
  /** Chave na resposta do resumo (`GET fonte.resumo`). */
  readonly chave: string;
  /** Filtros aplicados ao clicar; o contador fica ativo quando estão aplicados. */
  readonly filtro: Readonly<Record<string, string>>;
}

export interface AcaoLinha {
  readonly label: string;
  readonly variante?: SduiButtonVariant;
  /** Campo booleano da linha calculado pelo BFF (ex.: `podePegar`). Ausente = sempre habilitada. */
  readonly campoHabilitado?: string;
  readonly motivoBloqueio?: string;
  readonly confirmacao?: Confirmacao;
  /** `{campo}` no endpoint/rota é substituído pelo valor da linha (ex.: `/v1/propostas/{id}/atribuicao`). */
  readonly executa: Execucao;
}

export interface FilaScreen {
  readonly meta: TemplateMeta;
  readonly template: 'fila';
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly fonte: {
    /** Listagem paginada: recebe os filtros + `page`, `size`, `sortBy`, `sortDir`. */
    readonly listagem: string;
    /** Contadores: objeto com as `chave`s dos contadores. */
    readonly resumo?: string;
  };
  readonly contadores?: readonly ContadorFila[];
  readonly filtros: readonly FiltroFila[];
  readonly colunas: readonly ColunaFila[];
  readonly acoesLinha?: readonly AcaoLinha[];
  /** Campo identificador da linha (padrão: `id`). */
  readonly chaveLinha?: string;
  readonly paginacao?: {
    readonly tamanho?: number;
    readonly ordenacao?: { readonly campo: string; readonly direcao: 'asc' | 'desc' };
  };
  /** Substantivo do rodapé: "Exibindo 1-10 de 45 {itens}". */
  readonly itens?: string;
  readonly mensagemVazia?: string;
}

// ---------------------------------------------------------------------------
// Template "analise"
// ---------------------------------------------------------------------------

export interface CampoValor {
  readonly label: string;
  readonly valor: SduiPrimitive;
  readonly formato?: SduiFormat;
  /** Ocupa o dobro da largura. */
  readonly largo?: boolean;
  readonly destaque?: boolean;
}

export interface ColunaTabela {
  readonly campo: string;
  readonly label: string;
  readonly formato?: SduiFormat;
  readonly alinhamento?: 'inicio' | 'fim';
}

interface BlocoBase {
  /** Identificador estável do bloco (telemetria, testes, deep-link). */
  readonly id: string;
  readonly titulo: string;
  readonly icone?: string;
  readonly descricao?: string;
  readonly recolhivel?: boolean;
  readonly alertas?: readonly Alerta[];
}

export type Bloco =
  | (BlocoBase & { readonly tipo: 'campos'; readonly campos: readonly CampoValor[] })
  | (BlocoBase & {
      readonly tipo: 'tabela';
      readonly colunas: readonly ColunaTabela[];
      readonly linhas: readonly SduiRow[];
      readonly mensagemVazia?: string;
    });

interface CampoFormularioBase {
  /** Nome do campo — chave no corpo enviado ao BFF. */
  readonly campo: string;
  readonly label: string;
  readonly obrigatorio?: boolean;
  readonly minimo?: number;
  readonly maximo?: number;
  readonly mensagemObrigatorio?: string;
  readonly placeholder?: string;
  readonly dica?: string;
  readonly valorInicial?: string | null;
}

export type CampoFormulario =
  | (CampoFormularioBase & { readonly tipo: 'textarea'; readonly linhas?: number })
  | (CampoFormularioBase & { readonly tipo: 'select'; readonly opcoes: readonly SduiOption[] })
  | (CampoFormularioBase & { readonly tipo: 'texto' })
  | (CampoFormularioBase & { readonly tipo: 'data' });

export interface AcaoTela {
  readonly id: string;
  readonly label: string;
  readonly icone?: string;
  readonly variante?: SduiButtonVariant;
  /** Permissão calculada no BFF (perfil, alçada, status). */
  readonly habilitada?: boolean;
  readonly motivoBloqueio?: string;
  /** Campos do formulário que precisam estar válidos antes de executar. */
  readonly validar?: readonly string[];
  /** Só habilita quando estes campos do formulário estiverem preenchidos. */
  readonly exigePreenchidos?: readonly string[];
  readonly confirmacao?: Confirmacao;
  readonly executa: Execucao;
}

export interface AnaliseScreen {
  readonly meta: TemplateMeta;
  readonly template: 'analise';
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly etiquetas?: readonly Etiqueta[];
  readonly alertas?: readonly Alerta[];
  readonly blocos: readonly Bloco[];
  readonly formulario?: {
    readonly titulo: string;
    readonly icone?: string;
    readonly campos: readonly CampoFormulario[];
  };
  readonly acoes: readonly AcaoTela[];
}

export type TemplateScreen = FilaScreen | AnaliseScreen;
export type TemplateName = TemplateScreen['template'];
