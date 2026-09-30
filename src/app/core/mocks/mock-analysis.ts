import { AcaoTela, AnaliseScreen, Bloco, CampoValor } from '../../templates/template-contract.model';
import { MockProposal } from './mock-queue';

/**
 * Simula o BFF compondo a tela de análise (template "analise") a partir da
 * proposta + parametrização do produto. O BFF real faz o mesmo: busca a
 * proposta, aplica as regras (alçada, permissões) e envia os valores prontos.
 */

/** Limite de alçada N1 por produto — no BFF real vem da política de crédito. */
const LIMITE_N1: Readonly<Record<string, number>> = {
  CREDITO_VAREJO: 100_000,
  VEICULOS: 150_000,
  CONSORCIO: 300_000,
};

const MOTIVOS_DEVOLUCAO = [
  { value: 'DOC_PENDENTE', label: 'Documentação pendente' },
  { value: 'RENDA_NAO_COMPROVADA', label: 'Renda não comprovada' },
  { value: 'DIVERGENCIA_CADASTRAL', label: 'Divergência cadastral' },
  { value: 'AJUSTE_CONDICOES', label: 'Ajustar valor/prazo' },
];

export function buildAnaliseMock(p: MockProposal): AnaliseScreen {
  const d = details(p);
  const excede = p.valor > (LIMITE_N1[p.produto] ?? Infinity);
  const nivel = p.valor > 2 * (LIMITE_N1[p.produto] ?? Infinity) ? 'N3' : 'N2';
  const base = `/v1/propostas/${p.id}/acoes`;

  return {
    meta: {
      schemaVersion: '2.0',
      product: p.produto,
      revision: `analise-${p.produto.toLowerCase()}@2026.09.3`,
      generatedAt: new Date().toISOString(),
    },
    template: 'analise',
    titulo: `Proposta nº ${p.id}`,
    subtitulo: `${p.produtoDescricao} · ${p.loja ?? 'Agência 0457 · Paulista'}`,
    etiquetas: [
      { texto: p.statusDescricao, tom: 'info' },
      { texto: `Classificação: ${d.classificacao}`, tom: d.classificacao <= 'B' ? 'success' : 'warning' },
      { texto: p.segmento === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física' },
    ],
    alertas: [
      { tom: 'warning', titulo: 'Motivo do envio à mesa', mensagem: d.motivoMesa },
      ...(excede
        ? [{ tom: 'info' as const, titulo: 'Aprovação por alçada necessária', mensagem: `Esta proposta exige alçada ${nivel}. Sua alçada atual é N1.` }]
        : []),
    ],
    blocos: [
      {
        id: 'proposta',
        tipo: 'campos',
        titulo: 'Dados da proposta',
        icone: 'request_quote',
        campos: [
          { label: labelValor(p.produto), valor: p.valor, formato: 'currency', destaque: true },
          { label: 'Prazo', valor: d.prazo, formato: 'months' },
          ...(d.taxa !== null ? [{ label: 'Taxa mensal', valor: d.taxa, formato: 'percent' } satisfies CampoValor] : []),
          { label: 'Parcela', valor: d.parcela, formato: 'currency' },
          { label: 'Entrada na mesa', valor: p.dataEnvio, formato: 'datetime' },
          { label: 'Canal', valor: p.loja ? 'Correspondente' : 'Agência' },
        ],
      },
      ...produtoBlocos(p, d),
      {
        id: 'cliente',
        tipo: 'campos',
        titulo: 'Cliente',
        icone: p.segmento === 'PJ' ? 'business' : 'person',
        campos: [
          { label: p.segmento === 'PJ' ? 'Razão social' : 'Nome', valor: p.cliente, largo: true },
          { label: p.segmento === 'PJ' ? 'CNPJ' : 'CPF', valor: p.documento, formato: 'document' },
          { label: p.segmento === 'PJ' ? 'Faturamento mensal' : 'Renda mensal', valor: d.renda, formato: 'currency' },
          { label: 'Relacionamento', valor: d.relacionamento, formato: 'months' },
          { label: 'Score interno', valor: d.score, formato: 'number' },
          { label: 'Restrições ativas', valor: d.restricoes, formato: 'boolean' },
        ],
      },
      {
        id: 'operacoes',
        tipo: 'tabela',
        titulo: 'Operações ativas',
        icone: 'receipt_long',
        recolhivel: true,
        colunas: [
          { campo: 'contrato', label: 'Contrato' },
          { campo: 'modalidade', label: 'Modalidade' },
          { campo: 'saldoDevedor', label: 'Saldo devedor', formato: 'currency', alinhamento: 'fim' },
          { campo: 'diasAtraso', label: 'Dias em atraso', formato: 'number', alinhamento: 'fim' },
        ],
        linhas: d.operacoes,
        mensagemVazia: 'Cliente sem operações ativas.',
      },
    ],
    formulario: {
      titulo: 'Parecer do analista',
      icone: 'rate_review',
      campos: [
        {
          campo: 'parecer',
          tipo: 'textarea',
          label: 'Parecer',
          obrigatorio: true,
          minimo: 30,
          maximo: 2000,
          mensagemObrigatorio: 'O parecer é obrigatório para qualquer decisão.',
          placeholder: 'Justifique a decisão considerando capacidade de pagamento, histórico e garantias.',
        },
        {
          campo: 'motivoDevolucao',
          tipo: 'select',
          label: 'Motivo da devolução',
          obrigatorio: true,
          mensagemObrigatorio: 'Informe o motivo para devolver.',
          dica: 'Obrigatório apenas para devolver a proposta.',
          opcoes: [...MOTIVOS_DEVOLUCAO, ...(p.produto === 'VEICULOS' ? [{ value: 'VISTORIA_REPROVADA', label: 'Vistoria reprovada' }] : [])],
        },
      ],
    },
    acoes: [
      {
        id: 'DEVOLVER',
        label: 'Devolver',
        icone: 'undo',
        variante: 'ghost',
        exigePreenchidos: ['motivoDevolucao'],
        motivoBloqueio: 'Selecione o motivo da devolução.',
        validar: ['parecer', 'motivoDevolucao'],
        confirmacao: { titulo: 'Devolver proposta?', mensagem: `A proposta ${p.id} voltará para a origem.`, botao: 'Devolver' },
        executa: { tipo: 'requisicao', metodo: 'POST', endpoint: `${base}/devolver` },
      },
      {
        id: 'RECUSAR',
        label: 'Recusar',
        icone: 'block',
        variante: 'danger',
        validar: ['parecer'],
        confirmacao: { titulo: 'Recusar proposta?', mensagem: `Esta ação é definitiva para a proposta ${p.id}.`, botao: 'Recusar', tom: 'danger' },
        executa: { tipo: 'requisicao', metodo: 'POST', endpoint: `${base}/recusar`, enviar: ['parecer'] },
      },
      ...acoesProduto(p, base),
      ...(excede
        ? [
            {
              id: 'ENCAMINHAR_ALCADA',
              label: `Encaminhar para ${nivel}`,
              icone: 'forward',
              variante: 'secondary',
              validar: ['parecer'],
              executa: { tipo: 'requisicao', metodo: 'POST', endpoint: `${base}/encaminhar-alcada`, enviar: ['parecer'] },
            } satisfies AcaoTela,
          ]
        : []),
      {
        id: 'APROVAR',
        label: 'Aprovar',
        icone: 'check_circle',
        variante: 'primary',
        habilitada: !excede,
        motivoBloqueio: excede ? `Valor acima da sua alçada (N1). Encaminhe para aprovação ${nivel}.` : undefined,
        validar: ['parecer'],
        confirmacao: { titulo: 'Aprovar proposta?', mensagem: `A proposta ${p.id} será aprovada.`, botao: 'Aprovar' },
        executa: { tipo: 'requisicao', metodo: 'POST', endpoint: `${base}/aprovar`, enviar: ['parecer'] },
      },
    ],
  };
}

function produtoBlocos(p: MockProposal, d: Details): Bloco[] {
  switch (p.produto) {
    case 'VEICULOS': {
      const ltv = d.valorFipe ? p.valor / d.valorFipe : null;
      return [
        {
          id: 'veiculo',
          tipo: 'campos',
          titulo: 'Veículo e garantia',
          icone: 'directions_car',
          alertas:
            ltv !== null && ltv > 0.8
              ? [{ tom: 'warning', mensagem: 'LTV acima de 80% do valor FIPE. Avalie aumento de entrada ou redução de prazo.' }]
              : [],
          campos: [
            { label: 'Marca / modelo', valor: p.veiculo ?? null, largo: true },
            { label: 'Tipo', valor: p.tipoVeiculo === 'NOVO' ? 'Novo (0 km)' : 'Usado' },
            { label: 'Placa', valor: p.placa ?? null },
            { label: 'Loja parceira', valor: p.loja ?? null, largo: true },
            { label: 'Valor FIPE', valor: d.valorFipe, formato: 'currency' },
            { label: 'LTV', valor: ltv, formato: 'percent', destaque: true },
          ],
        },
      ];
    }
    case 'CONSORCIO': {
      const [grupo, cota] = (p.grupoCota ?? '/').split('/');
      return [
        {
          id: 'cota',
          tipo: 'campos',
          titulo: 'Grupo e cota',
          icone: 'groups',
          campos: [
            { label: 'Grupo', valor: grupo ?? null },
            { label: 'Cota', valor: cota ?? null },
            { label: 'Bem', valor: p.bemDescricao ?? null },
            { label: 'Contemplação', valor: p.contemplacaoDescricao ?? null },
            { label: 'Lance ofertado', valor: p.contemplacao === 'LANCE' ? 0.35 : null, formato: 'percent', destaque: true },
            { label: 'Taxa de administração', valor: 0.17, formato: 'percent' },
          ],
        },
      ];
    }
    default:
      return [
        {
          id: 'capacidade',
          tipo: 'campos',
          titulo: 'Capacidade de pagamento',
          icone: 'account_balance_wallet',
          descricao: 'Calculado pelo motor de crédito na entrada da proposta.',
          campos: [
            { label: 'Comprometimento atual', valor: d.comprometimento, formato: 'percent' },
            { label: 'Após a operação', valor: d.comprometimento + d.parcela / d.renda, formato: 'percent', destaque: true },
            { label: 'Endividamento total', valor: d.endividamento, formato: 'currency' },
            { label: 'Renda comprovada', valor: true, formato: 'boolean' },
          ],
        },
      ];
  }
}

function acoesProduto(p: MockProposal, base: string): AcaoTela[] {
  return p.produto === 'VEICULOS'
    ? [
        {
          id: 'SOLICITAR_VISTORIA',
          label: 'Solicitar vistoria',
          icone: 'car_crash',
          variante: 'secondary',
          confirmacao: { titulo: 'Solicitar vistoria?', mensagem: `Uma vistoria será agendada para o veículo ${p.placa ?? '0 km'}.`, botao: 'Solicitar' },
          executa: { tipo: 'requisicao', metodo: 'POST', endpoint: `${base}/solicitar-vistoria`, enviar: ['parecer'] },
        },
      ]
    : [];
}

function labelValor(produto: string): string {
  return produto === 'VEICULOS' ? 'Valor financiado' : produto === 'CONSORCIO' ? 'Valor da carta' : 'Valor solicitado';
}

type Details = ReturnType<typeof details>;

/** Dados complementares determinísticos por proposta (o BFF buscaria nos serviços de domínio). */
function details(p: MockProposal) {
  let seed = Number(p.id) % 2147483647 || 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const prazo = p.produto === 'CONSORCIO' ? 200 : p.produto === 'VEICULOS' ? 60 : 48;
  const taxa = p.produto === 'CONSORCIO' ? null : p.produto === 'VEICULOS' ? 0.0179 : 0.0219;
  const parcela = taxa ? (p.valor * taxa) / (1 - (1 + taxa) ** -prazo) : (p.valor * 1.17) / prazo;
  const renda = Math.round((p.segmento === 'PJ' ? 60_000 + rand() * 400_000 : 6_000 + rand() * 30_000) / 100) * 100;
  return {
    prazo,
    taxa,
    parcela: Math.round(parcela * 100) / 100,
    renda,
    relacionamento: Math.floor(6 + rand() * 150),
    score: Math.floor(520 + rand() * 330),
    restricoes: rand() < 0.15,
    classificacao: 'ABCD'[Math.floor(rand() * 4)]!,
    comprometimento: Math.round((0.1 + rand() * 0.3) * 100) / 100,
    endividamento: Math.round(rand() * 200_000),
    valorFipe: p.produto === 'VEICULOS' ? Math.round((p.valor / (0.55 + rand() * 0.4)) / 500) * 500 : null,
    motivoMesa: pick(rand(), [
      'Comprometimento de renda acima da política.',
      'Score abaixo do corte automático para o valor solicitado.',
      'Divergência cadastral entre bureau e cadastro interno.',
      'Valor acima do limite de aprovação automática.',
    ]),
    operacoes: Array.from({ length: Math.floor(rand() * 4) }, (_, i) => ({
      contrato: `CT-${String(Number(p.id) + i * 7).slice(-5)}`,
      modalidade: pick(rand(), ['Crédito pessoal', 'Cartão de crédito', 'Cheque especial', 'Consórcio auto']),
      saldoDevedor: Math.round(rand() * 40_000 * 100) / 100,
      diasAtraso: rand() < 0.2 ? Math.floor(rand() * 30) : 0,
    })),
  };
}

function pick<T>(r: number, list: readonly T[]): T {
  return list[Math.floor(r * list.length)]!;
}
