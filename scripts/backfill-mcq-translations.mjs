import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const model = process.env.TRANSLATION_MODEL || 'gpt-4.1-mini';
const batchSize = Number(process.env.TRANSLATION_BACKFILL_BATCH_SIZE || 20);

if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
  console.error('Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function translateQuestion(question) {
  const prompt = `Translate this exam-prep MCQ from English into Spanish and French.

Return JSON only.

Question: ${question.question_en}
A: ${question.option_a_en}
B: ${question.option_b_en}
C: ${question.option_c_en}
D: ${question.option_d_en}
Rationale: ${question.rationale_en || question.correct_rationale_en || ''}

JSON keys:
question_es, question_fr, option_a_es, option_a_fr, option_b_es, option_b_fr, option_c_es, option_c_fr, option_d_es, option_d_fr, rationale_es, rationale_fr`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a precise multilingual exam-prep translator. Output valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0]?.message?.content || '{}');
}

const { data: questions, error } = await supabase
  .from('questions')
  .select('id, question_en, option_a_en, option_b_en, option_c_en, option_d_en, rationale_en, correct_rationale_en')
  .or('question_es.is.null,question_es.eq.,question_fr.is.null,question_fr.eq.')
  .not('question_en', 'is', null)
  .limit(batchSize);

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!questions?.length) {
  console.log('No MCQ rows need translation backfill.');
  process.exit(0);
}

let updated = 0;
for (const question of questions) {
  const translations = await translateQuestion(question);
  const { error: updateError } = await supabase
    .from('questions')
    .update({
      question_es: translations.question_es || '',
      question_fr: translations.question_fr || '',
      option_a_es: translations.option_a_es || '',
      option_a_fr: translations.option_a_fr || '',
      option_b_es: translations.option_b_es || '',
      option_b_fr: translations.option_b_fr || '',
      option_c_es: translations.option_c_es || '',
      option_c_fr: translations.option_c_fr || '',
      option_d_es: translations.option_d_es || '',
      option_d_fr: translations.option_d_fr || '',
      rationale_es: translations.rationale_es || '',
      rationale_fr: translations.rationale_fr || '',
    })
    .eq('id', question.id);

  if (updateError) {
    console.error(`Failed ${question.id}: ${updateError.message}`);
  } else {
    updated += 1;
    console.log(`Translated ${question.id}`);
  }
}

console.log(`Backfill complete. Updated ${updated}/${questions.length} questions.`);
