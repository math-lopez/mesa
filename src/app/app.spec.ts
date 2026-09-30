import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  it('renderiza o shell', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.topbar__brand')?.textContent).toContain('Portal de Atendimento');
  });
});
