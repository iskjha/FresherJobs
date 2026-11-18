import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import { fetchJobsData } from '@redux/jobsSlice';
import { resetBoard } from '@redux/boardSlice';
import { IconButton } from '@components/PageHeader.jsx';

// Reloads overview data from the API and forces the board to refetch its
// columns from page 1 (even if the latest run is unchanged).
export default function RefreshButton({ compact = false, onRefresh }) {
  const dispatch = useDispatch();
  const loading = useSelector((s) => s.jobs.status === 'loading');
  const refresh = () => {
    dispatch(resetBoard(null));
    dispatch(fetchJobsData());
    onRefresh?.();
  };
  return (
    <IconButton label="Reload latest data" onClick={refresh} disabled={loading} compact={compact}>
      <RefreshCw size={compact ? 16 : 19} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
    </IconButton>
  );
}
