import { SduiPath, SduiPrimitive } from './sdui-binding.model';

/**
 * Regras declarativas (visibilidade / habilitação) avaliadas no cliente.
 *
 * É uma AST fechada — nunca `eval` de string vinda do servidor. Regras de
 * negócio pesadas (ex.: "excede alçada?") devem ser calculadas no BFF e
 * expostas como flag em `data`; aqui ficam só comparações simples e reativas
 * ao que o analista preenche.
 */
export type SduiCondition =
  | { readonly op: 'eq' | 'neq'; readonly path: SduiPath; readonly value: SduiPrimitive }
  | { readonly op: 'gt' | 'gte' | 'lt' | 'lte'; readonly path: SduiPath; readonly value: number }
  | { readonly op: 'in'; readonly path: SduiPath; readonly values: readonly SduiPrimitive[] }
  | { readonly op: 'exists' | 'empty'; readonly path: SduiPath }
  | { readonly op: 'and' | 'or'; readonly conditions: readonly SduiCondition[] }
  | { readonly op: 'not'; readonly condition: SduiCondition };
