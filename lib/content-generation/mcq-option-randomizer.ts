type OptionLetter = 'a' | 'b' | 'c' | 'd';

interface OptionBundle {
  letter: OptionLetter;
  en: string;
  es?: string;
  fr?: string;
  rationale?: string;
}

export interface RandomizedMcqOptions {
  option_a_en: string;
  option_a_es: string;
  option_a_fr: string;
  option_b_en: string;
  option_b_es: string;
  option_b_fr: string;
  option_c_en: string;
  option_c_es: string;
  option_c_fr: string;
  option_d_en: string;
  option_d_es: string;
  option_d_fr: string;
  option_a_rationale_en: string;
  option_b_rationale_en: string;
  option_c_rationale_en: string;
  option_d_rationale_en: string;
  correct_option: OptionLetter;
}

function normalizeLetter(value: unknown): OptionLetter {
  const normalized = String(value || '').trim().toLowerCase();
  return (['a', 'b', 'c', 'd'].includes(normalized) ? normalized : 'a') as OptionLetter;
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function randomizeMcqOptions(input: {
  correct_option: unknown;
  option_a_en: string;
  option_a_es?: string;
  option_a_fr?: string;
  option_b_en: string;
  option_b_es?: string;
  option_b_fr?: string;
  option_c_en: string;
  option_c_es?: string;
  option_c_fr?: string;
  option_d_en: string;
  option_d_es?: string;
  option_d_fr?: string;
  option_a_rationale_en?: string;
  option_b_rationale_en?: string;
  option_c_rationale_en?: string;
  option_d_rationale_en?: string;
}): RandomizedMcqOptions {
  const correctLetter = normalizeLetter(input.correct_option);
  const options: OptionBundle[] = [
    { letter: 'a', en: input.option_a_en, es: input.option_a_es, fr: input.option_a_fr, rationale: input.option_a_rationale_en },
    { letter: 'b', en: input.option_b_en, es: input.option_b_es, fr: input.option_b_fr, rationale: input.option_b_rationale_en },
    { letter: 'c', en: input.option_c_en, es: input.option_c_es, fr: input.option_c_fr, rationale: input.option_c_rationale_en },
    { letter: 'd', en: input.option_d_en, es: input.option_d_es, fr: input.option_d_fr, rationale: input.option_d_rationale_en },
  ];
  const randomized = shuffle(options);
  const letters: OptionLetter[] = ['a', 'b', 'c', 'd'];
  const correctIndex = randomized.findIndex((option) => option.letter === correctLetter);
  const [optionA, optionB, optionC, optionD] = randomized;

  return {
    option_a_en: optionA.en,
    option_a_es: optionA.es || '',
    option_a_fr: optionA.fr || '',
    option_b_en: optionB.en,
    option_b_es: optionB.es || '',
    option_b_fr: optionB.fr || '',
    option_c_en: optionC.en,
    option_c_es: optionC.es || '',
    option_c_fr: optionC.fr || '',
    option_d_en: optionD.en,
    option_d_es: optionD.es || '',
    option_d_fr: optionD.fr || '',
    option_a_rationale_en: optionA.rationale || '',
    option_b_rationale_en: optionB.rationale || '',
    option_c_rationale_en: optionC.rationale || '',
    option_d_rationale_en: optionD.rationale || '',
    correct_option: letters[correctIndex >= 0 ? correctIndex : 0],
  };
}
