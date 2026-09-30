/**
 * Simulação do IdP corporativo e da validação de token feita pelo BFF.
 *
 * Em produção o token é emitido pelo SSO (OIDC) e assinado; o BFF valida
 * assinatura (JWKS), `exp`, `aud` e `iss` antes de ler os claims. Aqui o
 * token é um JWT sem assinatura (`alg: none`), só para exercitar o fluxo.
 */

export interface MockTokenClaims {
  readonly sub: string;
  readonly name: string;
  /** Cargo exibido no topo (vem do diretório corporativo). */
  readonly title: string;
  /** Grupos do AD/IdP — é daqui que o BFF deriva a(s) mesa(s). */
  readonly groups: readonly string[];
  readonly exp: number;
}

export interface MockProfile {
  readonly sub: string;
  readonly name: string;
  readonly title: string;
  readonly groups: readonly string[];
  readonly description: string;
}

/** Perfis de teste oferecidos na tela de login simulada. */
export const MOCK_PROFILES: readonly MockProfile[] = [
  {
    sub: 'u-maria',
    name: 'Maria Silva',
    title: 'Analista',
    groups: ['GRP_MESA_CREDITO_VAREJO'],
    description: 'Analista da mesa de Crédito Varejo',
  },
  {
    sub: 'u-carlos',
    name: 'Carlos Souza',
    title: 'Analista',
    groups: ['GRP_MESA_VEICULOS'],
    description: 'Analista da mesa de Veículos',
  },
  {
    sub: 'u-fernanda',
    name: 'Fernanda Rocha',
    title: 'Analista',
    groups: ['GRP_MESA_CONSORCIO'],
    description: 'Analista da mesa de Consórcio',
  },
  {
    sub: 'u-ricardo',
    name: 'Ricardo Alves',
    title: 'Supervisor',
    groups: ['GRP_MESA_CREDITO_VAREJO', 'GRP_MESA_VEICULOS', 'GRP_SUPERVISOR'],
    description: 'Supervisor com acesso às mesas de Crédito Varejo e Veículos',
  },
  {
    sub: 'u-joao',
    name: 'João Lima',
    title: 'Analista',
    groups: ['GRP_BACKOFFICE'],
    description: 'Usuário sem mesa vinculada (o BFF nega acesso)',
  },
];

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export function issueMockToken(profile: MockProfile, now = Date.now()): string {
  const claims: MockTokenClaims = {
    sub: profile.sub,
    name: profile.name,
    title: profile.title,
    groups: profile.groups,
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  return `${base64UrlEncode({ alg: 'none', typ: 'JWT' })}.${base64UrlEncode(claims)}.mock`;
}

/** O que o BFF faria: extrair e validar os claims. `null` = token inválido/expirado (401). */
export function verifyMockToken(authorization: string | null, now = Date.now()): MockTokenClaims | null {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as Partial<MockTokenClaims>;
    const valid =
      typeof claims.sub === 'string' &&
      typeof claims.name === 'string' &&
      Array.isArray(claims.groups) &&
      typeof claims.exp === 'number' &&
      claims.exp * 1000 > now;
    return valid ? (claims as MockTokenClaims) : null;
  } catch {
    return null;
  }
}

function base64UrlEncode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
