import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAndUpdateQuestionIntegrity } from '@/lib/content-integrity/question-integrity-checker';
import { autoImproveStoredQuestion } from '@/lib/content-integrity/question-improver';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const generateSchema = z.object({
  type: z.enum(['mcq', 'flashcards', 'vignettes']),
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  count: z.number().int().min(1).max(25),
});

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function localizedValue(item: any, base: string, locale: 'en' | 'es' | 'fr', ...fallbacks: unknown[]) {
  return stringValue(item[`${base}_${locale}`], locale === 'en' ? item[base] : undefined, ...fallbacks);
}

function normalizeDifficulty(value: unknown) {
  return ['easy', 'medium', 'hard'].includes(String(value)) ? String(value) : 'medium';
}

function normalizeCorrectOption(value: unknown) {
  const option = String(value || '').toLowerCase().trim();
  return ['a', 'b', 'c', 'd'].includes(option) ? option : 'a';
}

export async function POST(req: NextRequest) {
  let parsedBody: z.infer<typeof generateSchema> | null = null;
  let adminUserId: string | null = null;
  let examName = '';

  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    adminUserId = adminUser.id;

    const parsed = generateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid generation request' }, { status: 400 });
    }
    parsedBody = parsed.data;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Add OPENAI_API_KEY to your environment variables.' },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [trackRes, topicRes] = await Promise.all([
      supabaseAdmin
        .from('exam_tracks')
        .select('id, name, full_name, category_id')
        .eq('id', parsedBody.examTrackId)
        .eq('active', true)
        .single(),
      supabaseAdmin
        .from('topics')
        .select('id, title, exam_track_id')
        .eq('id', parsedBody.topicId)
        .eq('exam_track_id', parsedBody.examTrackId)
        .single(),
    ]);

    if (!trackRes.data || !topicRes.data) {
      return NextResponse.json({ error: 'Exam track or topic not found' }, { status: 404 });
    }

    const trackName = trackRes.data.full_name || trackRes.data.name;
    examName = trackName;
    const topicTitle = topicRes.data.title;
    const { generateMCQs, generateFlashcards, generateVignettes } = await import('@/lib/openai');

    let items: any[] = [];
    let duplicateCount = 0;

    if (parsedBody.type === 'mcq') {
      const generated = await generateMCQs(trackName, topicTitle, Math.min(parsedBody.count, 25));
      const arr = Array.isArray(generated) ? generated : Object.values(generated);
      if (arr.length === 0) throw new Error('OpenAI returned zero MCQ questions.');
      const { data: existing } = await supabaseAdmin
        .from('questions')
        .select('question_en')
        .eq('exam_track_id', parsedBody.examTrackId)
        .eq('topic_id', parsedBody.topicId);
      const existingText = new Set((existing || []).map((q: any) => normalize(q.question_en)));

      items = arr
        .filter((q: any) => {
          const text = normalize(localizedValue(q, 'question', 'en'));
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((q: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          topic_id: parsedBody!.topicId,
          question_en: localizedValue(q, 'question', 'en'),
          question_es: localizedValue(q, 'question', 'es'),
          question_fr: localizedValue(q, 'question', 'fr'),
          option_a_en: localizedValue(q, 'option_a', 'en', q.options?.a, q.options?.A),
          option_a_es: localizedValue(q, 'option_a', 'es'),
          option_a_fr: localizedValue(q, 'option_a', 'fr'),
          option_b_en: localizedValue(q, 'option_b', 'en', q.options?.b, q.options?.B),
          option_b_es: localizedValue(q, 'option_b', 'es'),
          option_b_fr: localizedValue(q, 'option_b', 'fr'),
          option_c_en: localizedValue(q, 'option_c', 'en', q.options?.c, q.options?.C),
          option_c_es: localizedValue(q, 'option_c', 'es'),
          option_c_fr: localizedValue(q, 'option_c', 'fr'),
          option_d_en: localizedValue(q, 'option_d', 'en', q.options?.d, q.options?.D),
          option_d_es: localizedValue(q, 'option_d', 'es'),
          option_d_fr: localizedValue(q, 'option_d', 'fr'),
          correct_option: normalizeCorrectOption(q.correct_option),
          rationale_en: localizedValue(q, 'rationale', 'en', q.correct_rationale),
          rationale_es: localizedValue(q, 'rationale', 'es'),
          rationale_fr: localizedValue(q, 'rationale', 'fr'),
          difficulty: normalizeDifficulty(q.difficulty),
          active: false,
          reviewed: false,
        }));

      if (items.length) {
        const { data: inserted, error } = await supabaseAdmin.from('questions').insert(items).select('id');
        if (error) throw new Error(error.message);

        for (const question of inserted || []) {
          const checked = await checkAndUpdateQuestionIntegrity(supabaseAdmin, question.id);
          if (
            checked.result.blueprint_alignment_score < 90
            || checked.result.difficulty_quality_score < 80
            || checked.result.integrity_score < 85
          ) {
            await autoImproveStoredQuestion(supabaseAdmin, question.id);
          }
        }
      }
    } else if (parsedBody.type === 'flashcards') {
      const generated = await generateFlashcards(trackName, topicTitle, Math.min(parsedBody.count, 20));
      const arr = Array.isArray(generated) ? generated : Object.values(generated);
      if (arr.length === 0) throw new Error('OpenAI returned zero flashcards.');
      const { data: existing } = await supabaseAdmin
        .from('flashcards')
        .select('front_en')
        .eq('exam_track_id', parsedBody.examTrackId)
        .eq('topic_id', parsedBody.topicId);
      const existingText = new Set((existing || []).map((f: any) => normalize(f.front_en)));

      items = arr
        .filter((f: any) => {
          const text = normalize(localizedValue(f, 'front', 'en', f.question, f.term));
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((f: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          exam_name: examName,
          topic_id: parsedBody!.topicId,
          front_en: localizedValue(f, 'front', 'en', f.question, f.term),
          front_es: localizedValue(f, 'front', 'es'),
          front_fr: localizedValue(f, 'front', 'fr'),
          back_en: localizedValue(f, 'back', 'en', f.answer, f.explanation, f.definition),
          back_es: localizedValue(f, 'back', 'es'),
          back_fr: localizedValue(f, 'back', 'fr'),
          active: false,
          reviewed: false,
        }));

      if (items.length) {
        const { error } = await supabaseAdmin.from('flashcards').insert(items);
        if (error) throw new Error(error.message);
      }
    } else {
      const generated = await generateVignettes(trackName, topicTitle, Math.min(parsedBody.count, 10));
      const arr = Array.isArray(generated) ? generated : Object.values(generated);
      if (arr.length === 0) throw new Error('OpenAI returned zero case vignettes.');
      const { data: existing } = await supabaseAdmin
        .from('case_vignettes')
        .select('case_en')
        .eq('exam_track_id', parsedBody.examTrackId)
        .eq('topic_id', parsedBody.topicId);
      const existingText = new Set((existing || []).map((v: any) => normalize(v.case_en)));

      items = arr
        .filter((v: any) => {
          const text = normalize(localizedValue(v, 'case', 'en', v.scenario, v.vignette));
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((v: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          exam_name: examName,
          topic_id: parsedBody!.topicId,
          case_en: localizedValue(v, 'case', 'en', v.scenario, v.vignette),
          case_es: localizedValue(v, 'case', 'es'),
          case_fr: localizedValue(v, 'case', 'fr'),
          prompt_en: localizedValue(v, 'prompt', 'en', v.question),
          prompt_es: localizedValue(v, 'prompt', 'es'),
          prompt_fr: localizedValue(v, 'prompt', 'fr'),
          ideal_answer_en: localizedValue(v, 'ideal_answer', 'en', v.answer, v.model_answer),
          ideal_answer_es: localizedValue(v, 'ideal_answer', 'es'),
          ideal_answer_fr: localizedValue(v, 'ideal_answer', 'fr'),
          coaching_feedback_en: localizedValue(v, 'coaching_feedback', 'en', v.feedback, v.explanation),
          coaching_feedback_es: localizedValue(v, 'coaching_feedback', 'es'),
          coaching_feedback_fr: localizedValue(v, 'coaching_feedback', 'fr'),
          active: false,
          reviewed: false,
        }));

      if (items.length) {
        const { error } = await supabaseAdmin.from('case_vignettes').insert(items);
        if (error) throw new Error(error.message);
      }
    }

    await supabaseAdmin.from('generation_logs').insert({
      admin_user_id: adminUserId,
      exam_track_id: parsedBody.examTrackId,
      exam_name: examName,
      topic_id: parsedBody.topicId,
      content_type: parsedBody.type,
      requested_count: parsedBody.count,
      generated_count: items.length,
      duplicate_count: duplicateCount,
      status: 'success',
    });

    return NextResponse.json({ count: items.length, duplicates: duplicateCount, type: parsedBody.type });
  } catch (err: any) {
    console.error('AI generation error:', err);
    try {
      if (parsedBody) {
        await getSupabaseAdmin().from('generation_logs').insert({
          admin_user_id: adminUserId,
          exam_track_id: parsedBody.examTrackId,
          exam_name: examName,
          topic_id: parsedBody.topicId,
          content_type: parsedBody.type,
          requested_count: parsedBody.count,
          generated_count: 0,
          duplicate_count: 0,
          status: 'error',
          error_message: err.message,
        });
      }
    } catch {
      // Avoid masking the original generation error.
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
