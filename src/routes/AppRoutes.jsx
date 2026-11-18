import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout.jsx';
import JobsPage from '@modules/jobs/pages/JobsPage.jsx';
import InsightsPage from '@modules/insights/pages/InsightsPage.jsx';
import AccuracyPage from '@modules/accuracy/pages/AccuracyPage.jsx';
import AboutPage from '@modules/about/pages/AboutPage.jsx';
import { ROUTES } from './paths.js';

// Redirect that keeps the query string (shared filter links like /?cities=Pune).
function RedirectTo({ to }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<RedirectTo to={ROUTES.jobs} />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="how-it-works" element={<AboutPage />} />
        <Route path="about" element={<RedirectTo to={ROUTES.howItWorks} />} />
        <Route path="*" element={<RedirectTo to={ROUTES.jobs} />} />
      </Route>
    </Routes>
  );
}
