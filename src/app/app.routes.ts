import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { authGuard } from './core/auth/auth.guard';

/** Login simulado só existe com o BFF mockado; em produção o guard leva ao SSO. */
const devLogin: Routes = environment.useMockBff
  ? [
      {
        path: 'entrar',
        title: 'Entrar',
        loadComponent: () => import('./features/dev-login/dev-login.page').then((m) => m.DevLoginPage),
      },
    ]
  : [];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'fila' },
  ...devLogin,
  {
    path: '',
    canMatch: [authGuard],
    children: [
      {
        path: 'fila',
        title: 'Fila de propostas',
        loadComponent: () => import('./features/work-queue/work-queue.page').then((m) => m.WorkQueuePage),
      },
      {
        path: 'propostas/:id/analise',
        title: 'Análise da proposta',
        loadComponent: () =>
          import('./features/proposal-analysis/proposal-analysis.page').then((m) => m.ProposalAnalysisPage),
      },
      {
        path: 'propostas/:id/alcadas',
        title: 'Aprovação por alçada',
        loadComponent: () => import('./features/placeholders/upcoming.page').then((m) => m.UpcomingPage),
        data: { title: 'Aprovação por alçada (Tela 3)' },
      },
    ],
  },
  { path: '**', redirectTo: 'fila' },
];
