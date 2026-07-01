export { getOpenAIClient } from './client';
import { getOpenAIClient } from './client';

function parseGeneratedArray(content: string, keys: string[]) {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;

  for (const key of keys) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }

  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

export async function generateMCQs(examName: string, topicTitle: string, count: number = 10) {
  const openai = getOpenAIClient();
  const prompt = `Generate ${count} multiple choice questions for the ${examName} exam on the topic "${topicTitle}".

Return a JSON array with this exact structure for each question:
{
  "question_en": "Question text in English",
  "question_es": "Question text in Spanish",
  "question_fr": "Question text in French",
  "option_a_en": "Option A in English",
  "option_a_es": "Option A in Spanish",
  "option_a_fr": "Option A in French",
  "option_b_en": "Option B in English",
  "option_b_es": "Option B in Spanish",
  "option_b_fr": "Option B in French",
  "option_c_en": "Option C in English",
  "option_c_es": "Option C in Spanish",
  "option_c_fr": "Option C in French",
  "option_d_en": "Option D in English",
  "option_d_es": "Option D in Spanish",
  "option_d_fr": "Option D in French",
  "correct_option": "a" | "b" | "c" | "d",
  "rationale_en": "Detailed explanation in English",
  "rationale_es": "Detailed explanation in Spanish",
  "rationale_fr": "Detailed explanation in French",
  "difficulty": "easy" | "medium" | "hard"
}

Ensure questions are original, clinically accurate, appropriately difficult, and relevant to the certification exam. Do not copy proprietary exam items or published question-bank wording.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No content returned from OpenAI');

  return parseGeneratedArray(content, ['questions', 'mcqs', 'items']);
}

export async function generateFlashcards(examName: string, topicTitle: string, count: number = 10) {
  const openai = getOpenAIClient();
  const prompt = `Generate ${count} flashcards for the ${examName} exam on the topic "${topicTitle}".

Return a JSON array with this exact structure:
{
  "front_en": "Front of card in English",
  "front_es": "Front of card in Spanish",
  "front_fr": "Front of card in French",
  "back_en": "Back of card (answer/explanation) in English",
  "back_es": "Back of card in Spanish",
  "back_fr": "Back of card in French"
}

Make flashcards concise, memorable, original, and exam-relevant. Do not copy proprietary exam-prep wording.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No content returned from OpenAI');

  return parseGeneratedArray(content, ['flashcards', 'cards', 'items']);
}

export async function generateVignettes(examName: string, topicTitle: string, count: number = 5) {
  const openai = getOpenAIClient();
  const prompt = `Generate ${count} clinical case vignettes for the ${examName} exam on the topic "${topicTitle}".

Return a JSON array with this exact structure:
{
  "case_en": "Full case scenario in English",
  "case_es": "Full case scenario in Spanish",
  "case_fr": "Full case scenario in French",
  "prompt_en": "Question/prompt in English",
  "prompt_es": "Question/prompt in Spanish",
  "prompt_fr": "Question/prompt in French",
  "ideal_answer_en": "Ideal comprehensive answer in English",
  "ideal_answer_es": "Ideal answer in Spanish",
  "ideal_answer_fr": "Ideal answer in French",
  "coaching_feedback_en": "Coaching feedback and tips in English",
  "coaching_feedback_es": "Coaching feedback in Spanish",
  "coaching_feedback_fr": "Coaching feedback in French"
}

Cases should be original, realistic, complex, and test critical thinking. Do not copy proprietary exam items or published case material.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('No content returned from OpenAI');

  return parseGeneratedArray(content, ['vignettes', 'case_vignettes', 'cases', 'items']);
}

export * from './question-generator';
