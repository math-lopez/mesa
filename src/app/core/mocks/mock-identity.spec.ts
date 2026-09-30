import { MOCK_PROFILES, issueMockToken, verifyMockToken } from './mock-identity';
import { mesasDoUsuario, telaDaFila } from './mock-mesas';

const profile = (sub: string) => MOCK_PROFILES.find((p) => p.sub === sub)!;

describe('identidade simulada (IdP + validação do BFF)', () => {
  it('emite e valida o token preservando nome com acento e grupos', () => {
    const claims = verifyMockToken(`Bearer ${issueMockToken(profile('u-joao'))}`);
    expect(claims?.name).toBe('João Lima');
    expect(claims?.groups).toEqual(['GRP_BACKOFFICE']);
  });

  it('rejeita token ausente, malformado ou expirado', () => {
    expect(verifyMockToken(null)).toBeNull();
    expect(verifyMockToken('Bearer lixo')).toBeNull();
    const expired = issueMockToken(profile('u-maria'), Date.now() - 9 * 60 * 60 * 1000);
    expect(verifyMockToken(`Bearer ${expired}`)).toBeNull();
  });

  it('resolve a mesa e a tela da fila a partir dos grupos', () => {
    expect(telaDaFila(mesasDoUsuario(profile('u-carlos').groups))).toBe('telas/fila/VEICULOS.json');
    expect(telaDaFila(mesasDoUsuario(profile('u-fernanda').groups))).toBe('telas/fila/CONSORCIO.json');
    const supervisor = mesasDoUsuario(profile('u-ricardo').groups);
    expect(supervisor.map((m) => m.codigo)).toEqual(['CREDITO_VAREJO', 'VEICULOS']);
    expect(telaDaFila(supervisor)).toBe('telas/fila/GERAL.json');
    expect(mesasDoUsuario(profile('u-joao').groups)).toEqual([]);
  });
});
