'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard route error', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
      <div role="alert" className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Dashboard failed to load</h2>
        <p className="text-sm text-muted-foreground">
          Retry after checking your connection and subscription access.
        </p>
      </div>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
