'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application route error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The page could not finish loading. Retry the request or return to the dashboard.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
