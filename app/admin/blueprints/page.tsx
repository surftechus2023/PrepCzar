'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';
import type {
  BlueprintCompetency,
  BlueprintDomain,
  BlueprintObjective,
  ExamTrack,
} from '@/types/database';

interface Completeness {
  domainCount: number;
  competencyCount: number;
  objectiveCount: number;
  completeObjectiveCount: number;
  incompleteObjectiveCount: number;
  percentComplete: number;
}

type EditableRecord = BlueprintDomain | BlueprintCompetency | BlueprintObjective;
type RecordType = 'domain' | 'competency' | 'objective';

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isObjective(record: EditableRecord): record is BlueprintObjective {
  return 'learning_objective' in record;
}

function statusBadge(record: EditableRecord) {
  const incompleteObjective = isObjective(record) && (!hasText(record.official_blueprint_text) || !hasText(record.learning_objective));
  if (!record.active) return <Badge variant="secondary">Inactive</Badge>;
  if (record.is_placeholder || incompleteObjective) return <Badge variant="destructive">Needs metadata</Badge>;
  return <Badge className="bg-emerald-600">Complete</Badge>;
}

export default function AdminBlueprintsPage() {
  const [tracks, setTracks] = useState<ExamTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [domains, setDomains] = useState<BlueprintDomain[]>([]);
  const [competencies, setCompetencies] = useState<BlueprintCompetency[]>([]);
  const [objectives, setObjectives] = useState<BlueprintObjective[]>([]);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<BlueprintObjective & BlueprintDomain & BlueprintCompetency>>>({});
  const { toast } = useToast();

  const loadBlueprints = useCallback(async (trackId?: string) => {
    setLoading(true);
    const path = trackId ? `/api/admin/blueprints?trackId=${trackId}` : '/api/admin/blueprints';
    const res = await authenticatedFetch(path);
    const data = await res.json();

    if (!res.ok) {
      toast({ title: 'Could not load blueprints', description: data.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setTracks(data.tracks || []);
    setSelectedTrackId(data.selectedTrackId || trackId || '');
    setDomains(data.domains || []);
    setCompetencies(data.competencies || []);
    setObjectives(data.objectives || []);
    setCompleteness(data.completeness || null);
    setDrafts({});
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadBlueprints();
  }, [loadBlueprints]);

  const competenciesByDomain = useMemo(() => {
    return competencies.reduce<Record<string, BlueprintCompetency[]>>((acc, competency) => {
      acc[competency.domain_id] = acc[competency.domain_id] || [];
      acc[competency.domain_id].push(competency);
      return acc;
    }, {});
  }, [competencies]);

  const objectivesByCompetency = useMemo(() => {
    return objectives.reduce<Record<string, BlueprintObjective[]>>((acc, objective) => {
      acc[objective.competency_id] = acc[objective.competency_id] || [];
      acc[objective.competency_id].push(objective);
      return acc;
    }, {});
  }, [objectives]);

  function draftValue(record: EditableRecord, field: keyof BlueprintObjective) {
    const draft = drafts[record.id] as any;
    return draft?.[field] ?? (record as any)[field] ?? '';
  }

  function updateDraft(recordId: string, updates: Partial<BlueprintObjective & BlueprintDomain & BlueprintCompetency>) {
    setDrafts((prev) => ({ ...prev, [recordId]: { ...prev[recordId], ...updates } }));
  }

  async function saveRecord(type: RecordType, record: EditableRecord) {
    setSavingId(record.id);
    const draft = drafts[record.id] || {};
    const res = await authenticatedFetch('/api/admin/blueprints', {
      method: 'PATCH',
      body: JSON.stringify({
        type,
        id: record.id,
        ...draft,
      }),
    });
    const data = await res.json();
    setSavingId(null);

    if (!res.ok) {
      toast({ title: 'Blueprint update failed', description: data.error, variant: 'destructive' });
      return;
    }

    toast({ title: 'Blueprint record saved' });
    await loadBlueprints(selectedTrackId);
  }

  async function toggleRecord(type: RecordType, record: EditableRecord, field: 'active' | 'is_placeholder') {
    updateDraft(record.id, { [field]: !record[field] });
    setSavingId(record.id);
    const res = await authenticatedFetch('/api/admin/blueprints', {
      method: 'PATCH',
      body: JSON.stringify({
        type,
        id: record.id,
        [field]: !record[field],
      }),
    });
    const data = await res.json();
    setSavingId(null);

    if (!res.ok) {
      toast({ title: 'Blueprint update failed', description: data.error, variant: 'destructive' });
      return;
    }

    await loadBlueprints(selectedTrackId);
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blueprint Engine</h1>
          <p className="text-sm text-muted-foreground">
            Manage source-of-truth domains, competencies, and applied knowledge objectives.
          </p>
        </div>
        <select
          value={selectedTrackId}
          onChange={(event) => loadBlueprints(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name} · {track.slug}
            </option>
          ))}
        </select>
      </div>

      {completeness && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Completeness</p>
                <p className="text-2xl font-bold">{completeness.percentComplete}%</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Domains</p>
                <p className="text-lg font-semibold">{completeness.domainCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Competencies</p>
                <p className="text-lg font-semibold">{completeness.competencyCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Objectives</p>
                <p className="text-lg font-semibold">{completeness.objectiveCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Needs metadata</p>
                <p className="text-lg font-semibold text-red-600">{completeness.incompleteObjectiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {domains.map((domain) => (
          <Card key={domain.id} className="border-border">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    {domain.code}. {domain.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Weight: {domain.weight_percent ?? 'Not set'}% · {competenciesByDomain[domain.id]?.length || 0} competencies
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusBadge(domain)}
                  <Button size="sm" variant="outline" onClick={() => toggleRecord('domain', domain, 'active')}>
                    {domain.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleRecord('domain', domain, 'is_placeholder')}>
                    {domain.is_placeholder ? 'Mark Verified' : 'Mark Placeholder'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Textarea value={draftValue(domain, 'description')} onChange={(event) => updateDraft(domain.id, { description: event.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Official Blueprint Text</label>
                  <Textarea value={draftValue(domain, 'official_blueprint_text')} onChange={(event) => updateDraft(domain.id, { official_blueprint_text: event.target.value })} />
                </div>
              </div>
              <Button size="sm" onClick={() => saveRecord('domain', domain)} disabled={savingId === domain.id}>
                {savingId === domain.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Domain
              </Button>

              <div className="space-y-3">
                {(competenciesByDomain[domain.id] || []).map((competency) => (
                  <div key={competency.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold">{competency.code}. {competency.title}</h3>
                        <p className="text-xs text-muted-foreground">{objectivesByCompetency[competency.id]?.length || 0} applied knowledge statements</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {statusBadge(competency)}
                        <Button size="sm" variant="outline" onClick={() => toggleRecord('competency', competency, 'active')}>
                          {competency.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleRecord('competency', competency, 'is_placeholder')}>
                          {competency.is_placeholder ? 'Mark Verified' : 'Mark Placeholder'}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 mt-3">
                      <Textarea value={draftValue(competency, 'description')} onChange={(event) => updateDraft(competency.id, { description: event.target.value })} />
                      <Textarea value={draftValue(competency, 'official_blueprint_text')} onChange={(event) => updateDraft(competency.id, { official_blueprint_text: event.target.value })} />
                    </div>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => saveRecord('competency', competency)} disabled={savingId === competency.id}>
                      Save Competency
                    </Button>

                    <div className="mt-4 space-y-3">
                      {(objectivesByCompetency[competency.id] || []).map((objective) => (
                        <div key={objective.id} className="rounded-md bg-muted/40 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{objective.code}. {objective.title}</h4>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {statusBadge(objective)}
                                {!hasText(objective.learning_objective) && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Missing objective</Badge>}
                                {hasText(objective.learning_objective) && <Badge variant="secondary"><CheckCircle2 className="w-3 h-3 mr-1" />Learning objective</Badge>}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => toggleRecord('objective', objective, 'active')}>
                                {objective.active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => toggleRecord('objective', objective, 'is_placeholder')}>
                                {objective.is_placeholder ? 'Mark Verified' : 'Mark Placeholder'}
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3 mt-3">
                            <Input value={draftValue(objective, 'title')} onChange={(event) => updateDraft(objective.id, { title: event.target.value })} />
                            <Textarea value={draftValue(objective, 'learning_objective')} onChange={(event) => updateDraft(objective.id, { learning_objective: event.target.value })} />
                            <Textarea value={draftValue(objective, 'official_blueprint_text')} onChange={(event) => updateDraft(objective.id, { official_blueprint_text: event.target.value })} />
                          </div>
                          <Button className="mt-3" size="sm" onClick={() => saveRecord('objective', objective)} disabled={savingId === objective.id}>
                            Save Objective
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
