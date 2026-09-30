import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BRAND } from './brand';

/** Marca em CSS (sem asset). Trocar pelo logo oficial do DS quando disponível. */
@Component({
  selector: 'ds-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-size]': 'size()', role: 'img', '[attr.aria-label]': 'brand.name' },
  template: `<span aria-hidden="true">{{ brand.name }}</span>`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      background: var(--ds-brand-primary);
      color: var(--ds-brand-navy-strong);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    :host([data-size='sm']) {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-size: 11px;
    }
    :host([data-size='lg']) {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      font-size: 22px;
      box-shadow: 0 0 0 3px rgb(255 255 255 / 12%);
    }
  `,
})
export class DsLogoComponent {
  readonly size = input<'sm' | 'lg'>('sm');
  protected readonly brand = BRAND;
}
