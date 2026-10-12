import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';

const App = lazy(() => import('./App').then((module) => ({ default: module.App })));
const LandingPage = lazy(() => import('./components/Landing/LandingPage').then((module) => ({ default: module.LandingPage })));
const AccountPage = lazy(() => import('./components/Community/AccountPage').then((module) => ({ default: module.AccountPage })));
const PlazaPage = lazy(() => import('./components/Community/PlazaPage').then((module) => ({ default: module.PlazaPage })));
const ProfilePage = lazy(() => import('./components/Community/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const WorkPage = lazy(() => import('./components/Community/WorkPage').then((module) => ({ default: module.WorkPage })));

function PageFallback() {
  return <main className="page-fallback" role="status">正在打开数字积木…</main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/build" element={<App />} />
          <Route path="/start" element={<LandingPage />} />
          <Route path="/plaza" element={<PlazaPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/w/:workId" element={<WorkPage />} />
          <Route path="/u/:publicId" element={<ProfilePage />} />
          <Route path="*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
