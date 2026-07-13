'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, SlidersHorizontal, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/api';

interface AISetting {
  setting_key: string;
  label: string;
  provider: string;
  model_name: string;
  enabled: boolean;
  fallback_model: string;
  updated_at: string | null;
  cost_category: 'low' | 'medium' | 'high';
  optional: boolean;
  notes: string | null;
  estimated_cost_for_10: number;
}

export default function AdminAISettingsPage() {
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<AISetting>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [limits, setLimits] = useState({ maxGenerationQuantity: 25, dailyAdminGenerationLimit: 200, monthlyBudgetWarning: 0 });
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const response = await authenticatedFetch('/api/admin/ai-settings');
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      toast({ title: 'Could not load AI settings', description: data.error, variant: 'destructive' });
      return;
    }
    setSettings(data.settings || []);
    setAllowedModels(data.allowedModels || []);
    setLimits({
      maxGenerationQuantity: data.maxGenerationQuantity || 25,
      dailyAdminGenerationLimit: data.dailyAdminGenerationLimit || 200,
      monthlyBudgetWarning: data.monthlyBudgetWarning || 0,
    });
    setDrafts({});
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function draftValue(setting: AISetting, key: keyof AISetting) {
    return (drafts[setting.setting_key]?.[key] as any) ?? (setting as any)[key];
  }

  function updateDraft(settingKey: string, updates: Partial<AISetting>) {
    setDrafts((current) => ({ ...current, [settingKey]: { ...current[settingKey], ...updates } }));
  }

  async function save(setting: AISetting) {
    const modelName = String(draftValue(setting, 'model_name') || '').trim();
    if (!allowedModels.includes(modelName)) {
      toast({ title: 'Unsupported model', description: 'Add the model to OPENAI_ALLOWED_MODELS before saving.', variant: 'destructive' });
      return;
    }
    setSavingKey(setting.setting_key);
    const response = await authenticatedFetch('/api/admin/ai-settings', {
      method: 'PATCH',
      body: JSON.stringify({
        setting_key: setting.setting_key,
        provider: 'openai',
        model_name: modelName,
        enabled: Boolean(draftValue(setting, 'enabled')),
        notes: String(draftValue(setting, 'notes') || ''),
      }),
    });
    const data = await response.json();
    setSavingKey(null);
    if (!response.ok) {
      toast({ title: 'Save failed', description: data.error, variant: 'destructive' });
      return;
    }
    setSettings(data.settings || []);
    setDrafts({});
    toast({ title: 'AI model setting saved' });
  }

  async function action(setting: AISetting, actionName: 'test' | 'reset') {
    if (actionName === 'test') setTestingKey(setting.setting_key);
    else setSavingKey(setting.setting_key);
    const response = await authenticatedFetch('/api/admin/ai-settings', {
      method: 'POST',
      body: JSON.stringify({ action: actionName, setting_key: setting.setting_key }),
    });
    const data = await response.json();
    setTestingKey(null);
    setSavingKey(null);
    if (!response.ok) {
      toast({ title: actionName === 'test' ? 'Model test failed' : 'Reset failed', description: data.error, variant: 'destructive' });
      return;
    }
    if (data.settings) {
      setSettings(data.settings);
      setDrafts({});
    }
    toast({ title: actionName === 'test' ? 'Model connection succeeded' : 'Model reset to default' });
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          AI Model Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure OpenAI models by task without editing source code. Resolution order: database setting, environment variable, safe default.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Max generation request</p>
            <p className="text-lg font-semibold">{limits.maxGenerationQuantity} items</p>
          </div>
          <div>
            <p className="text-muted-foreground">Daily admin generation limit</p>
            <p className="text-lg font-semibold">{limits.dailyAdminGenerationLimit} items</p>
          </div>
          <div>
            <p className="text-muted-foreground">Monthly budget warning</p>
            <p className="text-lg font-semibold">{limits.monthlyBudgetWarning ? `$${limits.monthlyBudgetWarning}` : 'Not configured'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {settings.map((setting) => (
          <Card key={setting.setting_key}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{setting.label}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={draftValue(setting, 'enabled') ? 'default' : 'secondary'}>{draftValue(setting, 'enabled') ? 'Enabled' : 'Disabled'}</Badge>
                  <Badge variant="outline">{setting.provider}</Badge>
                  <Badge variant="outline">{setting.cost_category} cost</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Model</Label>
                  <Input
                    list="openai-models"
                    value={draftValue(setting, 'model_name')}
                    onChange={(event) => updateDraft(setting.setting_key, { model_name: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Fallback model</Label>
                  <Input value={setting.fallback_model} disabled />
                </div>
                <div>
                  <Label>Estimated cost for 10 items</Label>
                  <Input value={`$${setting.estimated_cost_for_10}`} disabled />
                </div>
              </div>
              <datalist id="openai-models">
                {allowedModels.map((model) => <option key={model} value={model} />)}
              </datalist>
              <div>
                <Label>Notes</Label>
                <Textarea value={draftValue(setting, 'notes') || ''} onChange={(event) => updateDraft(setting.setting_key, { notes: event.target.value })} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(draftValue(setting, 'enabled'))}
                    disabled={!setting.optional}
                    onChange={(event) => updateDraft(setting.setting_key, { enabled: event.target.checked })}
                  />
                  Enabled {setting.optional ? '' : '(required)'}
                </label>
                <Button size="sm" onClick={() => save(setting)} disabled={savingKey === setting.setting_key}>
                  {savingKey === setting.setting_key ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => action(setting, 'test')} disabled={testingKey === setting.setting_key || !draftValue(setting, 'enabled')}>
                  {testingKey === setting.setting_key ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Test Model
                </Button>
                <Button size="sm" variant="outline" onClick={() => action(setting, 'reset')} disabled={savingKey === setting.setting_key}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Default
                </Button>
                <span className="text-xs text-muted-foreground">
                  Last updated: {setting.updated_at ? new Date(setting.updated_at).toLocaleString() : 'Environment/default'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
