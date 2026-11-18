import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@redux/store';
import { fetchJobsData } from '@redux/jobsSlice';
import AppRoutes from '@/routes/AppRoutes.jsx';

// Loads the dataset once; every page reads it from Redux.
function DataBootstrap({ children }) {
  const dispatch = useDispatch();
  const status = useSelector((s) => s.jobs.status);
  useEffect(() => {
    if (status === 'idle') dispatch(fetchJobsData());
  }, [dispatch, status]);
  return children;
}

// Clean URLs (/jobs, /insights …). Vite (dev) and Express (production) both
// fall back to index.html for unknown paths, so deep links and refresh work.
export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DataBootstrap>
          <AppRoutes />
        </DataBootstrap>
      </BrowserRouter>
    </Provider>
  );
}
