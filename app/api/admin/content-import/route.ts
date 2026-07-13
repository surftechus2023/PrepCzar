import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { cleanImportedItems } from '@/lib/content-import/import-cleaner';
import { parseCsvContent } from '@/lib/content-import/parse-csv';
import { parseDocxBuffer } from '@/lib/content-import/parse-docx';
import { parsePdfBuffer } from '@/lib/content-import/parse-pdf';
import { parseTextContent } from '@/lib/content-import/parse-text';
import type { ImportedContentType, ImportCleanupMode, ParsedImportItem } from '@/lib/content-import/types';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['txt', 'csv', 'pdf', 'docx']);
const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const EXECUTABLE_EXTENSIONS = new Set(['exe', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'js', 'msi', 'com', 'scr']);

const importSchema = z.object({
  batchId: z.string().uuid().optional().nullable(),
  contentType: z.enum(['mcq', 'flashcards', 'vignettes']),
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  subtopicId: z.string().uuid().optional().nullable(),
  socialWorkBlueprintItemId: z.string().uuid().optional().nullable(),
  blueprintContentArea: z.string().optional().nullable(),
  blueprintCompetencySection: z.string().optional().nullable(),
  appliedKnowledgeStatement: z.string().optional().nullable(),
  questionWritingGuideline: z.string().optional().nullable(),
  blueprintReferenceText: z.string().optional().nullable(),
  learningObjective: z.string().optional().nullable(),
  difficulty: z.enum(['medium', 'hard']).default('medium'),
  cognitiveLevel: z.string().optional().nullable(),
  source: z.string().default('manual'),
  filename: z.string().optional().nullable(),
  runIntegrity: z.boolean().default(false),
  items: z.array(z.any()).min(1),
});

function fileExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function assertSafeFile(file: File) {
  const extension = fileExtension(file.name);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) throw new Error(`Unsupported file extension: .${extension || 'unknown'}`);
  if (EXECUTABLE_EXTENSIONS.has(extension)) throw new Error('Executable files are not allowed.');
  if (file.size <= 0) throw new Error('Uploaded file is empty.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Uploaded file exceeds the 8 MB limit.');
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) throw new Error(`Unsupported MIME type: ${file.type}`);
}

function duplicateHash(trackId: string, type: ImportedContentType, text: string) {
  return createHash('sha256').update(`${trackId}:${type}:${text.toLowerCase().replace(/\s+/g, ' ').trim()}`).digest('hex');
}

function parseBuffer(buffer: Buffer, extension: string, contentType: ImportedContentType) {
  if (extension === 'pdf') return parsePdfBuffer(buffer);
  if (extension === 'docx') return parseDocxBuffer(buffer);
  const text = buffer.toString('utf8');
  return { text, warnings: extension === 'csv' ? [] : [] };
}

async function getBlueprintDefaults(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  input: { topicId: string; subtopicId?: string | null; socialWorkBlueprintItemId?: string | null }
) {
  const [topicRes, subtopicRes, blueprintRes] = await Promise.all([
    supabaseAdmin.from('topics').select('title, official_blueprint_text, official_weight_percent').eq('id', input.topicId).maybeSingle(),
    input.subtopicId
      ? supabaseAdmin.from('subtopics').select('title, learning_objective, official_blueprint_text').eq('id', input.subtopicId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.socialWorkBlueprintItemId
      ? supabaseAdmin.from('social_work_blueprint_items').select('*').eq('id', input.socialWorkBlueprintItemId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const error = topicRes.error || subtopicRes.error || blueprintRes.error;
  if (error) throw new Error(error.message);
  return {
    topic: topicRes.data,
    subtopic: subtopicRes.data,
    blueprintItem: blueprintRes.data as any,
  };
}

function normalizeItem(item: any): ParsedImportItem {
  return {
    id: String(item.id || crypto.randomUUID()),
    contentType: item.contentType,
    originalText: String(item.originalText || ''),
    confidence: Number(item.confidence || 0),
    include: item.include !== false,
    validationErrors: Array.isArray(item.validationErrors) ? item.validationErrors.map(String) : [],
    missingFields: Array.isArray(item.missingFields) ? item.missingFields.map(String) : [],
    fields: item.fields || {},
  };
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { data, error } = await (getSupabaseAdmin() as any)
      .from('content_import_batches')
      .select('*, exam_track:exam_tracks(name), topic:topics(title)')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw new Error(error.message);
    return NextResponse.json({ batches: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load import batches.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const form = await req.formData();
    const contentType = form.get('contentType') as ImportedContentType;
    const cleanupMode = (form.get('cleanupMode') || 'parse_only') as ImportCleanupMode;
    const examTrackId = String(form.get('examTrackId') || '');
    const topicId = String(form.get('topicId') || '');
    const subtopicId = String(form.get('subtopicId') || '') || null;
    const socialWorkBlueprintItemId = String(form.get('socialWorkBlueprintItemId') || '') || null;
    const pastedText = String(form.get('pastedText') || '');
    const file = form.get('file');

    if (!['mcq', 'flashcards', 'vignettes'].includes(contentType)) throw new Error('Valid content type is required.');
    if (!examTrackId || !topicId) throw new Error('Exam track and topic are required.');

    let sourceText = pastedText.trim();
    let filename: string | null = null;
    let warnings: string[] = [];
    let extension = 'txt';

    if (file instanceof File && file.size > 0) {
      assertSafeFile(file);
      filename = file.name;
      extension = fileExtension(file.name);
      const parsed = parseBuffer(Buffer.from(await file.arrayBuffer()), extension, contentType);
      sourceText = parsed.text;
      warnings = parsed.warnings;
    }

    if (!sourceText.trim()) throw new Error('No importable text was found.');

    const items = extension === 'csv'
      ? parseCsvContent(sourceText, contentType)
      : parseTextContent(sourceText, contentType);
    const cleanedItems = await cleanImportedItems(items, cleanupMode);

    const { data: batch, error } = await (getSupabaseAdmin() as any)
      .from('content_import_batches')
      .insert({
        admin_user_id: adminUser.id,
        source: file instanceof File && file.size > 0 ? 'file' : 'pasted_text',
        filename,
        content_type: contentType,
        exam_track_id: examTrackId,
        topic_id: topicId,
        subtopic_id: subtopicId,
        social_work_blueprint_item_id: socialWorkBlueprintItemId,
        quantity_detected: cleanedItems.length,
        quantity_selected: cleanedItems.filter((item) => item.include).length,
        status: 'previewed',
        errors: warnings,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ batch, items: cleanedItems, warnings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import preview failed.' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  let batchId: string | null = null;
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = importSchema.parse(await req.json());
    batchId = body.batchId || null;
    const defaults = await getBlueprintDefaults(supabaseAdmin, body);
    const selected = body.items.map(normalizeItem).filter((item) => item.include);
    if (!selected.length) throw new Error('Select at least one valid item to import.');

    if (!batchId) {
      const { data: batch, error } = await (supabaseAdmin as any)
        .from('content_import_batches')
        .insert({
          admin_user_id: adminUser.id,
          source: body.source,
          filename: body.filename,
          content_type: body.contentType,
          exam_track_id: body.examTrackId,
          topic_id: body.topicId,
          subtopic_id: body.subtopicId,
          social_work_blueprint_item_id: body.socialWorkBlueprintItemId,
          quantity_detected: body.items.length,
          quantity_selected: selected.length,
          status: 'importing',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      batchId = batch.id;
    } else {
      await (supabaseAdmin as any).from('content_import_batches').update({ status: 'importing', quantity_selected: selected.length }).eq('id', batchId);
    }

    const common = {
      exam_track_id: body.examTrackId,
      topic_id: body.topicId,
      subtopic_id: body.subtopicId || null,
      import_batch_id: batchId,
      source_filename: body.filename || null,
      reviewed: false,
      active: false,
    };

    let insertedIds: string[] = [];
    if (body.contentType === 'mcq') {
      const rows = selected.map((item) => ({
        ...common,
        social_work_blueprint_item_id: body.socialWorkBlueprintItemId || null,
        blueprint_content_area: body.blueprintContentArea || defaults.blueprintItem?.major_content_area || null,
        blueprint_competency_section: body.blueprintCompetencySection || defaults.blueprintItem?.competency_section || null,
        applied_knowledge_statement: body.appliedKnowledgeStatement || defaults.blueprintItem?.applied_knowledge_statement || null,
        question_writing_guideline: body.questionWritingGuideline || defaults.blueprintItem?.sample_style_guidance || null,
        intended_cognitive_level: body.cognitiveLevel || 'application',
        blueprint_reference_text: body.blueprintReferenceText || defaults.blueprintItem?.official_blueprint_text || defaults.subtopic?.official_blueprint_text || defaults.topic?.official_blueprint_text || null,
        difficulty: body.difficulty,
        question_en: item.fields.question,
        question_es: '',
        question_fr: '',
        option_a_en: item.fields.option_a,
        option_a_es: '',
        option_a_fr: '',
        option_b_en: item.fields.option_b,
        option_b_es: '',
        option_b_fr: '',
        option_c_en: item.fields.option_c,
        option_c_es: '',
        option_c_fr: '',
        option_d_en: item.fields.option_d || '',
        option_d_es: '',
        option_d_fr: '',
        correct_option: item.fields.correct_option || 'a',
        rationale_en: item.fields.rationale || '',
        rationale_es: '',
        rationale_fr: '',
        correct_rationale_en: item.fields.rationale || '',
        subtopic: defaults.subtopic?.title || null,
        learning_objective: body.learningObjective || defaults.blueprintItem?.applied_knowledge_statement || defaults.subtopic?.learning_objective || null,
        cognitive_level: body.cognitiveLevel || 'application',
        source_topic: defaults.topic?.title || null,
        duplicate_hash: duplicateHash(body.examTrackId, 'mcq', item.fields.question || ''),
        generated_by_ai: false,
        integrity_status: 'pending',
        original_import_text: item.originalText,
      }));
      const { data, error } = await (supabaseAdmin as any).from('questions').insert(rows).select('id');
      if (error) throw new Error(error.message);
      insertedIds = (data || []).map((row: any) => row.id);
      if (body.runIntegrity) {
        for (const id of insertedIds) await checkAndUpdateQuestionIntegrity(supabaseAdmin, id);
      }
    } else if (body.contentType === 'flashcards') {
      const rows = selected.map((item) => ({
        ...common,
        blueprint_reference_text: body.blueprintReferenceText || defaults.subtopic?.official_blueprint_text || defaults.topic?.official_blueprint_text || null,
        source_topic: defaults.topic?.title || null,
        learning_objective: body.learningObjective || defaults.subtopic?.learning_objective || null,
        difficulty: body.difficulty,
        cognitive_level: body.cognitiveLevel || 'application',
        front_en: item.fields.front,
        front_es: '',
        front_fr: '',
        back_en: item.fields.back,
        back_es: '',
        back_fr: '',
        duplicate_hash: duplicateHash(body.examTrackId, 'flashcards', item.fields.front || ''),
        original_import_text: item.originalText,
      }));
      const { data, error } = await (supabaseAdmin as any).from('flashcards').insert(rows).select('id');
      if (error) throw new Error(error.message);
      insertedIds = (data || []).map((row: any) => row.id);
    } else {
      const rows = selected.map((item) => ({
        ...common,
        blueprint_reference_text: body.blueprintReferenceText || defaults.subtopic?.official_blueprint_text || defaults.topic?.official_blueprint_text || null,
        source_topic: defaults.topic?.title || null,
        learning_objective: body.learningObjective || defaults.subtopic?.learning_objective || null,
        difficulty: body.difficulty,
        cognitive_level: body.cognitiveLevel || 'application',
        case_en: item.fields.case,
        case_es: '',
        case_fr: '',
        prompt_en: item.fields.prompt,
        prompt_es: '',
        prompt_fr: '',
        ideal_answer_en: item.fields.ideal_answer,
        ideal_answer_es: '',
        ideal_answer_fr: '',
        coaching_feedback_en: item.fields.coaching_feedback || '',
        coaching_feedback_es: '',
        coaching_feedback_fr: '',
        expected_answer_elements: [],
        scoring_rubric: {},
        duplicate_hash: duplicateHash(body.examTrackId, 'vignettes', item.fields.case || ''),
        original_import_text: item.originalText,
      }));
      const { data, error } = await (supabaseAdmin as any).from('case_vignettes').insert(rows).select('id');
      if (error) throw new Error(error.message);
      insertedIds = (data || []).map((row: any) => row.id);
    }

    await (supabaseAdmin as any)
      .from('content_import_batches')
      .update({
        quantity_inserted: insertedIds.length,
        quantity_rejected: selected.length - insertedIds.length,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    return NextResponse.json({ batchId, insertedIds, inserted: insertedIds.length });
  } catch (err: any) {
    if (batchId) {
      await (getSupabaseAdmin() as any)
        .from('content_import_batches')
        .update({ status: 'failed', errors: [err.message || 'Import failed'], completed_at: new Date().toISOString() })
        .eq('id', batchId);
    }
    return NextResponse.json({ error: err.message || 'Import failed.' }, { status: 400 });
  }
}
