import filaGeral from '../../../../public/mocks/telas/fila/GERAL.json';
import filaCredito from '../../../../public/mocks/telas/fila/CREDITO_VAREJO.json';
import filaVeiculos from '../../../../public/mocks/telas/fila/VEICULOS.json';
import filaConsorcio from '../../../../public/mocks/telas/fila/CONSORCIO.json';
import propostas from '../../../../public/mocks/fila/propostas.json';

import { DS_COMPONENT_MAP } from '../../design-system/ds-component-map';
import { compileTemplateScreen } from '../../templates/compile-template';
import { SduiNode, SduiSchemaError, SduiScreen } from '../sdui';
import { buildAnaliseMock } from './mock-analysis';
import { MockProposal } from './mock-queue';

/**
 * Teste de contrato: tudo que o BFF (hoje simulado) devolve precisa passar
 * pelo compilador de templates e gerar uma árvore que o motor renderiza.
 * Quando o BFF real existir, rode o mesmo teste contra respostas gravadas dele.
 */
const proposta = (produto: string) => (propostas as MockProposal[]).find((p) => p.produto === produto)!;

const respostas: Record<string, unknown> = {
  'fila GERAL': filaGeral,
  'fila CREDITO_VAREJO': filaCredito,
  'fila VEICULOS': filaVeiculos,
  'fila CONSORCIO': filaConsorcio,
  'analise CREDITO_VAREJO': buildAnaliseMock(proposta('CREDITO_VAREJO')),
  'analise VEICULOS': buildAnaliseMock(proposta('VEICULOS')),
  'analise CONSORCIO': buildAnaliseMock(proposta('CONSORCIO')),
};

describe('contrato das telas do BFF (v2, por template)', () => {
  for (const [nome, raw] of Object.entries(respostas)) {
    describe(nome, () => {
      const screen = compileTemplateScreen(raw);
      const nodes = flatten(screen.layout);

      it('gera apenas tipos registrados no Design System', () => {
        expect(nodes.filter((node) => !Object.hasOwn(DS_COMPONENT_MAP, node.type)).map((n) => n.type)).toEqual([]);
      });

      it('só referencia ações existentes (nós, linhas e onSuccess)', () => {
        expect(referencedActions(screen).filter((id) => !(id in screen.actions))).toEqual([]);
      });

      it('só faz bind em caminhos de state existentes e em sources declarados', () => {
        const json = JSON.stringify(screen);
        const statePaths = [...json.matchAll(/"(state\.[\w.]+)"/g)].map((m) => m[1]!);
        expect(statePaths.filter((p) => resolve(screen, p) === undefined)).toEqual([]);
        const sources = [...json.matchAll(/"sources\.(\w+)\./g)].map((m) => m[1]!);
        expect(sources.filter((name) => !screen.sources?.[name])).toEqual([]);
      });
    });
  }

  it('recusa major diferente, template desconhecido e listas obrigatórias ausentes', () => {
    const meta = { schemaVersion: '2.0', product: 'X', revision: 'r', generatedAt: '' };
    expect(() => compileTemplateScreen({ ...filaGeral, meta: { ...meta, schemaVersion: '1.0' } })).toThrow(/v1\.0 não suportado/);
    expect(() => compileTemplateScreen({ meta, template: 'dashboard' })).toThrow(/Template de tela desconhecido/);
    expect(() => compileTemplateScreen({ meta, template: 'fila', filtros: [] })).toThrow(SduiSchemaError);
  });
});

function flatten(node: SduiNode): SduiNode[] {
  const children = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()];
  return [node, ...children.flatMap(flatten)];
}

function referencedActions(screen: SduiScreen): string[] {
  const fromNodes = flatten(screen.layout).flatMap((node) => {
    const on = 'on' in node ? Object.values(node.on ?? {}) : [];
    const rows =
      node.type === 'data.table' ? node.props.columns.flatMap((c) => c.actions?.map((a) => a.action) ?? []) : [];
    return [...on, ...rows] as string[];
  });
  return [...fromNodes, ...Object.values(screen.actions).flatMap((action) => action.onSuccess ?? [])];
}

function resolve(screen: SduiScreen, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], screen);
}
