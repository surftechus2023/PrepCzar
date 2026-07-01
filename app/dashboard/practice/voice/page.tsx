'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authenticatedFetch } from '@/lib/api';

export default function VoicePracticePage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function openFirstVoicePractice() {
      try {
        const res = await authenticatedFetch('/api/dashboard/access');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load exam access');

        const firstAccess = json.access?.[0];
        if (!firstAccess?.exam_track_id) {
          if (active) setError('No active exam subscription found.');
          return;
        }

        router.replace(`/dashboard/practice/mcq?exam=${firstAccess.exam_track_id}&voice=1`);
      } catch (err: any) {
        if (active) setError(err.message || 'Could not start voice practice.');
      }
    }

    openFirstVoicePractice();

    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-24">
        <Mic className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Voice Practice Unavailable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/dashboard/subscriptions">View Subscriptions</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Opening voice practice...</p>
      </div>
    </div>
  );
}
