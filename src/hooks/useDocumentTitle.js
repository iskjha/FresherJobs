import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · FresherJobs India` : 'FresherJobs India';
  }, [title]);
}
