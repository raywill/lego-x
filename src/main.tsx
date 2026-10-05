import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { AccountPage } from './components/Community/AccountPage';
import { PlazaPage } from './components/Community/PlazaPage';
import { ProfilePage } from './components/Community/ProfilePage';
import { WorkPage } from './components/Community/WorkPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/build" element={<App />} />
        <Route path="/plaza" element={<PlazaPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/w/:workId" element={<WorkPage />} />
        <Route path="/u/:publicId" element={<ProfilePage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
