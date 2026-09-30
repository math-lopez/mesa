import { Pipe, PipeTransform } from '@angular/core';

import { SduiFormat, SduiTone } from '../models';

const LOCALE = 'pt-BR';

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat(LOCALE);
const date = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short' });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const EMPTY = '—';

/**
 * Formatação centralizada e independente do Design System: qualquer wrapper
 * (Material hoje, DS corporativo amanhã) exibe valores do mesmo jeito.
 */
export function formatSduiValue(value: unknown, format: SduiFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return EMPTY;

  switch (format) {
    case 'currency':
      return typeof value === 'number' ? currency.format(value) : String(value);
    case 'percent':
      return typeof value === 'number' ? percent.format(value) : String(value);
    case 'number':
      return typeof value === 'number' ? number.format(value) : String(value);
    case 'months':
      return typeof value === 'number' ? `${value} ${value === 1 ? 'mês' : 'meses'}` : String(value);
    case 'date':
    case 'datetime': {
      const parsed = new Date(String(value));
      if (Number.isNaN(parsed.getTime())) return String(value);
      // pt-BR usa "dd/mm/aaaa, hh:mm"; o padrão da mesa é sem vírgula.
      return (format === 'date' ? date : dateTime).format(parsed).replace(',', '');
    }
    case 'cpf':
      return mask(String(value), /^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    case 'cnpj':
      return mask(String(value), /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    case 'document':
      return formatSduiValue(value, String(value).replace(/\D/g, '').length > 11 ? 'cnpj' : 'cpf');
    case 'boolean':
      return value === true ? 'Sim' : value === false ? 'Não' : String(value);
    case 'text':
      return String(value);
  }
}

function mask(raw: string, pattern: RegExp, replacement: string): string {
  const digits = raw.replace(/\D/g, '');
  return pattern.test(digits) ? digits.replace(pattern, replacement) : raw;
}

/** Tom efetivo de um badge: mapeamento por valor > tom fixo > neutro. */
export function resolveTone(
  value: string | null | undefined,
  toneMap?: Readonly<Record<string, SduiTone>>,
  fallback: SduiTone = 'neutral',
): SduiTone {
  return (value != null ? toneMap?.[value] : undefined) ?? fallback;
}

@Pipe({ name: 'sduiFormat' })
export class SduiFormatPipe implements PipeTransform {
  transform(value: unknown, format?: SduiFormat): string {
    return formatSduiValue(value, format);
  }
}
