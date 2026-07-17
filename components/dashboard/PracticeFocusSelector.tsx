'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  const [selectedTopic, setSelectedTopic] = useState('all');
  const startUrl = useMemo(
    () => `${basePath}?exam=${examId}&start=new&topic=${selectedTopic}`,
    [basePath, examId, selectedTopic]
  );

  return (
    <div className="p-6 max-w-2xl mx-auto py-12">
      <div className="text-center mb-8">
        <BookOpen className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-3">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div>
            <label htmlFor="practice-topic" className="text-sm font-medium text-foreground">
              Exam topic
            </label>
            <select
              id="practice-topic"
              value={selectedTopic}
              onChange={(event) => setSelectedTopic(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All syllabus topics</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                  {option.weight !== null ? ` — ${option.weight}%` : ''}
                  {option.count > 0 ? ` (${option.count} approved item${option.count === 1 ? '' : 's'})` : ' (no approved items yet)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Choose any topic from the exam syllabus before starting a new session. If a topic has no approved content yet, the session will show an availability message.
            </p>
          </div>

          <Button asChild className="w-full">
            <Link href={startUrl}>Start New Session</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
