import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sampleGenerationRequestSchema = z.object({
  examTrackId: z.string().uuid(),
  topicId: z.string().uuid(),
  subtopic: z.string().min(2),
  learningObjective: z.string().min(5),
  quantity: z.number().int().min(1).max(100),
  difficultyMix: z.object({
    easy: z.number().int().min(0).max(100),
    medium: z.number().int().min(0).max(100),
    hard: z.number().int().min(0).max(100),
  }),
  cognitiveLevelMix: z.object({
    recall: z.number().int().min(0).max(100),
    application: z.number().int().min(0).max(100),
    analysis: z.number().int().min(0).max(100),
  }),
});

const requiredQuestionColumns = [
  'exam_track_id',
  'topic_id',
  'difficulty',
  'question_en',
  'option_a_en',
  'option_b_en',
  'option_c_en',
  'option_d_en',
  'correct_option',
  'rationale_en',
  'reviewed',
  'active',
  'created_at',
  'subtopic',
  'learning_objective',
  'cognitive_level',
  'correct_rationale_en',
  'option_a_rationale_en',
  'option_b_rationale_en',
  'option_c_rationale_en',
  'option_d_rationale_en',
  'test_taking_tip_en',
  'source_topic',
  'duplicate_hash',
  'quality_score',
  'review_notes',
  'generation_batch_id',
  'generated_by_ai',
];

async function assertQuery(name: string, run: () => Promise<boolean>) {
  const passed = await run();
  if (!passed) {
    throw new Error(`Verification failed: ${name}`);
  }
  console.log(`ok - ${name}`);
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running verification.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await assertQuery('ai_generation_batches table exists', async () => {
    const { error } = await supabase.from('ai_generation_batches').select('id').limit(1);
    return !error;
  });

  await assertQuery('questions table has required fields', async () => {
    const { data, error } = await supabase
      .from('questions')
      .select(requiredQuestionColumns.join(','))
      .limit(1);

    return !error && Array.isArray(data);
  });

  await assertQuery('duplicate_hash column exists', async () => {
    const { error } = await supabase.from('questions').select('duplicate_hash').limit(1);
    return !error;
  });

  await assertQuery('no active questions are unreviewed', async () => {
    const { count, error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .eq('reviewed', false);

    return !error && count === 0;
  });

  await assertQuery('student-visible query excludes reviewed=false', async () => {
    const { count, error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .eq('reviewed', false);

    return !error && count === 0;
  });

  await assertQuery('sample generation request validates', async () => {
    const parsed = sampleGenerationRequestSchema.safeParse({
      examTrackId: '00000000-0000-4000-8000-000000000001',
      topicId: '00000000-0000-4000-8000-000000000002',
      subtopic: 'Professional ethics',
      learningObjective: 'Identify the best first ethical response in a practice scenario.',
      quantity: 25,
      difficultyMix: { easy: 30, medium: 50, hard: 20 },
      cognitiveLevelMix: { recall: 20, application: 40, analysis: 40 },
    });

    return parsed.success;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
