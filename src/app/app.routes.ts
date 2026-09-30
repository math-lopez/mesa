import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'fila' },
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
  { path: '**', redirectTo: 'fila' },
];
