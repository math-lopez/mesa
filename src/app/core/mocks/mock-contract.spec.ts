import varejo from '../../../../public/mocks/telas/analise/PRP-2026-000123.json';
import veiculos from '../../../../public/mocks/telas/analise/PRP-2026-000456.json';
import consorcio from '../../../../public/mocks/telas/analise/PRP-2026-000789.json';
import incompativel from '../../../../public/mocks/telas/analise/PRP-2026-000999.json';
import filaGeral from '../../../../public/mocks/telas/fila/GERAL.json';
import filaCredito from '../../../../public/mocks/telas/fila/CREDITO_VAREJO.json';
import filaVeiculos from '../../../../public/mocks/telas/fila/VEICULOS.json';
import filaConsorcio from '../../../../public/mocks/telas/fila/CONSORCIO.json';

import { DS_COMPONENT_MAP } from '../../design-system/ds-component-map';
import { SduiNode, SduiSchemaError, SduiScreen, parseSduiScreen } from '../sdui';

/**
 * Teste de contrato: os mocks são a especificação viva do BFF.
 * Quando o BFF real existir, este mesmo teste pode rodar contra respostas gravadas dele.
 */
describe('contrato SDUI dos mocks do BFF', () => {
  const screens = { filaGeral, filaCredito, filaVeiculos, filaConsorcio, varejo, veiculos, consorcio };

  for (const [nome, raw] of Object.entries(screens)) {
    describe(nome, () => {
      const screen = parseSduiScreen(raw);
      const nodes = flatten(screen.layout);

      it('usa apenas tipos registrados no Design System', () => {
        const unknown = nodes.filter((node) => !Object.hasOwn(DS_COMPONENT_MAP, node.type));
        expect(unknown.map((node) => node.type)).toEqual([]);
      });

      it('só referencia ações existentes no catálogo (nós, linhas de tabela e onSuccess)', () => {
        const missing = referencedActions(screen).filter((id) => !(id in screen.actions));
        expect(missing).toEqual([]);
      });

      it('só faz bind em caminhos estáticos que existem em data/state', () => {
        const paths = JSON.stringify(screen).match(/"\$bind":"((?:data|state)\.[^"]+)"/g) ?? [];
        const missing = paths.map((p) => p.slice(9, -1)).filter((p) => resolve(screen, p) === undefined);
        expect(missing).toEqual([]);
      });

      it('só faz bind em sources declarados', () => {
        const used = [...JSON.stringify(screen).matchAll(/"sources\.(\w+)\./g)].map((m) => m[1]!);
        expect(used.filter((name) => !screen.sources?.[name])).toEqual([]);
      });
    });
  }

  it('rejeita contrato de major incompatível', () => {
    expect(() => parseSduiScreen(incompativel)).toThrow(SduiSchemaError);
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
      node.type === 'data.table'
        ? node.props.columns.flatMap((column) => column.actions?.map((a) => a.action) ?? [])
        : [];
    return [...on, ...rows] as string[];
  });
  const chained = Object.values(screen.actions).flatMap((action) => action.onSuccess ?? []);
  return [...fromNodes, ...chained];
}

function resolve(screen: { data: object; state: object }, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], screen);
}
