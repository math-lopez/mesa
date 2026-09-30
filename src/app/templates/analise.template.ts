import { SduiAction, SduiNode, SduiScreen } from '../core/sdui';
import { allFilled, statePath, toConfirm, toSduiAction } from './template-actions';
import { Alerta, AnaliseScreen, Bloco, CampoFormulario } from './template-contract.model';

/**
 * LAYOUT BASE DA ANÁLISE — fixo no front:
 *
 *   ┌ título / subtítulo
 *   ├ etiquetas (status, classificação...) + alertas da proposta
 *   ├ blocos do BFF, na ordem recebida (campos em grade de 4 ou tabela)
 *   ├ formulário do analista (parecer, motivo...)
 *   └ rodapé fixo com as ações
 *
 * O BFF envia os valores já prontos e decide quais blocos, campos e ações
 * existem (inclusive permissões). O front decide a disposição.
 */

const FIELD_COLUMNS = 4;

export function buildAnaliseScreen(screen: AnaliseScreen): SduiScreen {
  const campos = screen.formulario?.campos ?? [];

  return {
    meta: { ...screen.meta, screenId: 'analise' },
    data: {},
    state: Object.fromEntries(campos.map((campo) => [campo.campo, campo.valorInicial ?? null])),
    actions: Object.fromEntries(screen.acoes.map((acao): [string, SduiAction] => [
      acao.id,
      toSduiAction(acao.executa, {
        enabled: acao.habilitada,
        enabledWhen: allFilled((acao.exigePreenchidos ?? []).map((campo) => statePath(campo))),
        disabledReason: acao.motivoBloqueio,
        validate: acao.validar?.map((campo) => statePath(campo)),
        confirm: toConfirm(acao.confirmacao),
        payload: Object.fromEntries(
          (acao.executa.tipo === 'requisicao' ? (acao.executa.enviar ?? campos.map((c) => c.campo)) : []).map(
            (campo) => [campo, { $bind: statePath(campo) }],
          ),
        ),
      }),
    ])),
    layout: {
      id: 'page',
      type: 'layout.page',
      props: { title: screen.titulo, subtitle: screen.subtitulo },
      slots: {
        header: [
          ...(screen.etiquetas ?? []).map((etiqueta, i): SduiNode => ({
            id: `etiqueta-${i}`,
            type: 'display.badge',
            props: { value: etiqueta.texto, tone: etiqueta.tom ?? 'neutral' },
          })),
          ...alerts('alerta', screen.alertas),
        ],
        main: [
          ...screen.blocos.map(blockNode),
          ...(screen.formulario
            ? [
                {
                  id: 'formulario',
                  type: 'layout.section',
                  props: { title: screen.formulario.titulo, icon: screen.formulario.icone },
                  children: campos.map(formField),
                } satisfies SduiNode,
              ]
            : []),
        ],
        footer: [
          {
            id: 'acoes',
            type: 'layout.actionBar',
            props: { align: 'end' },
            children: screen.acoes.map((acao): SduiNode => ({
              id: `acao-${acao.id}`,
              type: 'action.button',
              props: { label: acao.label, icon: acao.icone, variant: acao.variante ?? 'secondary' },
              on: { click: acao.id },
            })),
          },
        ],
      },
    },
  };
}

function blockNode(bloco: Bloco): SduiNode {
  const content: SduiNode =
    bloco.tipo === 'campos'
      ? {
          id: `${bloco.id}-grade`,
          type: 'layout.grid',
          props: { columns: FIELD_COLUMNS },
          children: bloco.campos.map((campo, i): SduiNode => ({
            id: `${bloco.id}-campo-${i}`,
            type: 'display.field',
            span: campo.largo ? 2 : 1,
            props: { label: campo.label, value: campo.valor, format: campo.formato, emphasis: campo.destaque },
          })),
        }
      : {
          id: `${bloco.id}-tabela`,
          type: 'display.table',
          props: {
            columns: bloco.colunas.map((coluna) => ({
              key: coluna.campo,
              header: coluna.label,
              format: coluna.formato,
              align: coluna.alinhamento === 'fim' ? 'end' : 'start',
            })),
            rows: bloco.linhas,
            emptyMessage: bloco.mensagemVazia,
          },
        };

  return {
    id: `bloco-${bloco.id}`,
    type: 'layout.section',
    props: { title: bloco.titulo, icon: bloco.icone, description: bloco.descricao, collapsible: bloco.recolhivel },
    children: [...alerts(`${bloco.id}-alerta`, bloco.alertas), content],
  };
}

function alerts(prefix: string, alertas: readonly Alerta[] | undefined): SduiNode[] {
  return (alertas ?? []).map((alerta, i) => ({
    id: `${prefix}-${i}`,
    type: 'display.alert',
    props: { tone: alerta.tom, title: alerta.titulo, message: alerta.mensagem },
  }));
}

function formField(campo: CampoFormulario): SduiNode {
  const common = {
    id: `campo-${campo.campo}`,
    bind: statePath(campo.campo),
    validators: {
      required: campo.obrigatorio,
      minLength: campo.minimo,
      maxLength: campo.maximo,
      messages: campo.mensagemObrigatorio ? { required: campo.mensagemObrigatorio } : undefined,
    },
  } as const;
  const props = { label: campo.label, placeholder: campo.placeholder, hint: campo.dica };
  switch (campo.tipo) {
    case 'textarea':
      return { ...common, type: 'input.textarea', props: { ...props, rows: campo.linhas ?? 5 } };
    case 'select':
      return { ...common, type: 'input.select', props: { ...props, options: campo.opcoes } };
    case 'texto':
      return { ...common, type: 'input.text', props };
    case 'data':
      return { ...common, type: 'input.date', props };
  }
}
