import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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

export async function POST(req: NextRequest) {
  let parsedBody: z.infer<typeof generateSchema> | null = null;
  let adminUserId: string | null = null;

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
          const text = normalize(q.question_en);
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((q: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          topic_id: parsedBody!.topicId,
          question_en: q.question_en || '',
          question_es: q.question_es || '',
          question_fr: q.question_fr || '',
          option_a_en: q.option_a_en || '',
          option_a_es: q.option_a_es || '',
          option_a_fr: q.option_a_fr || '',
          option_b_en: q.option_b_en || '',
          option_b_es: q.option_b_es || '',
          option_b_fr: q.option_b_fr || '',
          option_c_en: q.option_c_en || '',
          option_c_es: q.option_c_es || '',
          option_c_fr: q.option_c_fr || '',
          option_d_en: q.option_d_en || '',
          option_d_es: q.option_d_es || '',
          option_d_fr: q.option_d_fr || '',
          correct_option: ['a', 'b', 'c', 'd'].includes(String(q.correct_option).toLowerCase())
            ? String(q.correct_option).toLowerCase()
            : 'a',
          rationale_en: q.rationale_en || '',
          rationale_es: q.rationale_es || '',
          rationale_fr: q.rationale_fr || '',
          difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
          active: false,
          reviewed: false,
        }));

      if (items.length) {
        const { error } = await supabaseAdmin.from('questions').insert(items);
        if (error) throw new Error(error.message);
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
          const text = normalize(f.front_en);
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((f: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          topic_id: parsedBody!.topicId,
          front_en: f.front_en || '',
          front_es: f.front_es || '',
          front_fr: f.front_fr || '',
          back_en: f.back_en || '',
          back_es: f.back_es || '',
          back_fr: f.back_fr || '',
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
          const text = normalize(v.case_en);
          const duplicate = !text || existingText.has(text);
          if (!duplicate) existingText.add(text);
          else duplicateCount += 1;
          return !duplicate;
        })
        .map((v: any) => ({
          exam_track_id: parsedBody!.examTrackId,
          topic_id: parsedBody!.topicId,
          case_en: v.case_en || '',
          case_es: v.case_es || '',
          case_fr: v.case_fr || '',
          prompt_en: v.prompt_en || '',
          prompt_es: v.prompt_es || '',
          prompt_fr: v.prompt_fr || '',
          ideal_answer_en: v.ideal_answer_en || '',
          ideal_answer_es: v.ideal_answer_es || '',
          ideal_answer_fr: v.ideal_answer_fr || '',
          coaching_feedback_en: v.coaching_feedback_en || '',
          coaching_feedback_es: v.coaching_feedback_es || '',
          coaching_feedback_fr: v.coaching_feedback_fr || '',
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
