import { Outlet } from 'react-router-dom';
import Sidebar from '@components/Sidebar/Sidebar.jsx';

// Every page fills the viewport and scrolls its own body, so there is no
// page-level footer or scrollbar.
export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="pl-[72px] md:pl-[92px]">
        <main className="px-5 py-6 sm:px-8 lg:px-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
