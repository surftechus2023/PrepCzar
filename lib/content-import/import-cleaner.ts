import type { ImportCleanupMode, ParsedImportItem } from './types';
import { getOpenAIClient } from '@/lib/openai/client';
import { resolveConfiguredModel } from '@/lib/openai/model-config';
import { temperatureOption } from '@/lib/openai/request-options';

const IMPORT_CLEANUP_MODEL = resolveConfiguredModel('IMPORT_CLEANUP_MODEL', 'gpt-4.1-mini');

function deterministicClean(items: ParsedImportItem[]) {
  return items.map((item) => ({
    ...item,
    fields: Object.fromEntries(
      Object.entries(item.fields).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
      ])
    ),
  }));
}

async function aiCleanItem(item: ParsedImportItem, mode: ImportCleanupMode) {
  if (!process.env.OPENAI_API_KEY) return item;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: IMPORT_CLEANUP_MODEL,
    ...temperatureOption(IMPORT_CLEANUP_MODEL, 0.2),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You clean imported exam-prep content into structured fields. Preserve meaning and do not invent facts. Return JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          mode,
          contentType: item.contentType,
          originalText: item.originalText,
          fields: item.fields,
          instructions: [
            'parse_structure: only fix field boundaries and formatting',
            'structure_improve: improve clarity, grammar, and rationale completeness without changing blueprint scope',
            'structure_improve_review: also flag missing fields and low-confidence issues',
            'Never create substantive new licensing-exam content from scratch',
          ],
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return item;

  try {
    const parsed = JSON.parse(content);
    const fields = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed;
    return {
      ...item,
      fields: { ...item.fields, ...fields },
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : item.confidence,
      validationErrors: Array.isArray(parsed.validationErrors) ? parsed.validationErrors.map(String) : item.validationErrors,
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String) : item.missingFields,
    };
  } catch {
    return item;
  }
}

export async function cleanImportedItems(items: ParsedImportItem[], mode: ImportCleanupMode) {
  const cleaned = deterministicClean(items);
  if (mode === 'parse_only' || mode === 'parse_structure') return cleaned;

  const improved: ParsedImportItem[] = [];
  for (const item of cleaned) {
    improved.push(await aiCleanItem(item, mode));
  }
  return improved;
}
