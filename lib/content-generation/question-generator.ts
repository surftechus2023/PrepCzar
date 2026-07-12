export {
  QUESTION_GENERATOR_MODEL,
  QUESTION_PROMPT_VERSION,
  generateQuestions,
  generatedQuestionSchema,
  questionGenerationInputSchema,
} from '@/lib/openai/question-generator';
export type {
  GeneratedQuestion,
  QuestionGenerationInput,
} from '@/lib/openai/question-generator';
