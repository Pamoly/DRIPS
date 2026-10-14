import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppProvider } from './lib/store';
import AppShell from './components/AppShell';
import { Skeleton, Toaster } from './components/ui';
import Landing from './pages/Landing';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Proposals = lazy(() => import('./pages/Proposals'));
const ProposalEditor = lazy(() => import('./pages/ProposalEditor'));
const TaxExpenses = lazy(() => import('./pages/TaxExpenses'));
const InvoicesBooks = lazy(() => import('./pages/InvoicesBooks'));
const ProjectBoard = lazy(() => import('./pages/ProjectBoard'));
const TimeTracker = lazy(() => import('./pages/TimeTracker'));
const Clients = lazy(() => import('./pages/Clients'));
const Goals = lazy(() => import('./pages/Goals'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PublicProposal = lazy(() => import('./pages/PublicProposal'));

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/p/:shareToken"
            element={
              <Suspense fallback={<PageFallback />}>
                <PublicProposal />
              </Suspense>
            }
          />
          <Route
            path="/app"
            element={
              <AppShell>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="proposals" element={<Proposals />} />
                    <Route path="proposals/:id" element={<ProposalEditor />} />
                    <Route path="tax" element={<TaxExpenses />} />
                    <Route path="invoices" element={<InvoicesBooks />} />
                    <Route path="board" element={<ProjectBoard />} />
                    <Route path="time" element={<TimeTracker />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </Suspense>
              </AppShell>
            }
          />
          <Route path="*" element={<Landing />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  </StrictMode>,
);
