export const environment = {
  production: false,
  bffBaseUrl: '/bff',
  /** Enquanto o BFF não existe, o interceptor responde com os JSONs de `public/mocks`. */
  useMockBff: true,
  /** Loga no console a sequência de chamadas ao BFF e eventos do motor (ver core/debug). */
  debug: true,
};
