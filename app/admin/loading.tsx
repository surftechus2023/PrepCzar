import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading admin tools…</span>
      </div>
    </div>
  );
}
