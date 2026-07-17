'use client';

import Link from 'next/link';
import { BookOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface PracticeFocusOption {
  id: string;
  title: string;
  count: number;
  weight: number | null;
}

interface PracticeFocusSelectorProps {
  basePath: string;
  examId: string;
  title: string;
  description: string;
  options: PracticeFocusOption[];
}

export function PracticeFocusSelector({
  basePath,
  examId,
  title,
  description,
  options,
}: PracticeFocusSelectorProps) {
  return (
    <div className="p-6 max-w-3xl mx-auto py-12">
      <div className="text-center mb-8">
        <BookOpen className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-3">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">All areas</p>
                <p className="text-sm text-muted-foreground">Use the full approved content pool for this exam track.</p>
              </div>
            </div>
            <Button asChild>
              <Link href={`${basePath}?exam=${examId}&start=new&topic=all`}>Start All Areas</Link>
            </Button>
          </CardContent>
        </Card>

        {options.map((option) => (
          <Card key={option.id} className="border-border">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{option.title}</p>
                  {option.weight !== null && <Badge variant="outline">{option.weight}%</Badge>}
                  <Badge variant={option.count > 0 ? 'secondary' : 'outline'}>
                    {option.count > 0 ? `${option.count} item${option.count === 1 ? '' : 's'}` : 'No approved items yet'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Focus this session on this topic or blueprint area.</p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`${basePath}?exam=${examId}&start=new&topic=${option.id}`}>Start Focus Area</Link>
              </Button>
            </CardContent>
          </Card>
        ))}

        {options.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No topic-mapped content is available yet. Use All areas to practice from approved content.
          </p>
        )}
      </div>
    </div>
  );
}
