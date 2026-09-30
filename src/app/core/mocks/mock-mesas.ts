/**
 * Parametrização que no BFF real vive no "Serviço Parametrizador":
 * grupo do IdP → mesa → layout da fila. O front nunca conhece este mapa.
 */

export type MesaCodigo = 'CREDITO_VAREJO' | 'VEICULOS' | 'CONSORCIO';

export interface Mesa {
  readonly codigo: MesaCodigo;
  readonly nome: string;
  /** Produto(s) que a mesa enxerga na fila. */
  readonly produtos: readonly string[];
}

export const MESAS: Readonly<Record<MesaCodigo, Mesa>> = {
  CREDITO_VAREJO: { codigo: 'CREDITO_VAREJO', nome: 'Mesa Crédito Varejo', produtos: ['CREDITO_VAREJO'] },
  VEICULOS: { codigo: 'VEICULOS', nome: 'Mesa Veículos', produtos: ['VEICULOS'] },
  CONSORCIO: { codigo: 'CONSORCIO', nome: 'Mesa Consórcio', produtos: ['CONSORCIO'] },
};

const MESA_POR_GRUPO: Readonly<Record<string, MesaCodigo>> = {
  GRP_MESA_CREDITO_VAREJO: 'CREDITO_VAREJO',
  GRP_MESA_VEICULOS: 'VEICULOS',
  GRP_MESA_CONSORCIO: 'CONSORCIO',
};

/** Mesas do usuário, na ordem do catálogo. Vazio = sem acesso à mesa julgamental. */
export function mesasDoUsuario(groups: readonly string[]): readonly Mesa[] {
  const codigos = new Set(groups.map((group) => MESA_POR_GRUPO[group]).filter(Boolean));
  return Object.values(MESAS).filter((mesa) => codigos.has(mesa.codigo));
}

/** Uma mesa → layout específico; várias (supervisor) → visão consolidada. */
export function telaDaFila(mesas: readonly Mesa[]): string {
  return mesas.length === 1 ? `telas/fila/${mesas[0]!.codigo}.json` : 'telas/fila/GERAL.json';
}
