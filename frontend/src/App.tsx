import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { StandardLayout } from './components/StandardLayout';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { StatusPage } from './pages/StatusPage';
import { ReceptionPage } from './pages/ReceptionPage';
import { BarberPage } from './pages/BarberPage';
import { DisplayPage } from './pages/DisplayPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Screens 1 to 5 and 7 use StandardLayout with Navbar */}
          <Route path="/" element={<StandardLayout><HomePage /></StandardLayout>} />
          <Route path="/join" element={<StandardLayout><JoinPage /></StandardLayout>} />
          <Route path="/status/:id" element={<StandardLayout><StatusPage /></StandardLayout>} />
          <Route path="/status" element={<Navigate to="/status/S-14" replace />} />
          <Route path="/reception" element={<StandardLayout><ReceptionPage /></StandardLayout>} />
          <Route path="/barber/:name" element={<StandardLayout><BarberPage /></StandardLayout>} />
          <Route path="/barber" element={<Navigate to="/barber/Ravi" replace />} />
          <Route path="/admin" element={<StandardLayout><AdminPage /></StandardLayout>} />

          {/* Screen 6: Dedicated Fullscreen Layout WITHOUT normal navigation bar */}
          <Route path="/display" element={<DisplayPage />} />

          {/* Catch-all redirect to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
