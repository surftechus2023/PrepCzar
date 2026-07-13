const OPTION_LETTERS = ['a', 'b', 'c', 'd'];

const ORDINAL_MAP = new Map([
  ['first', 'a'],
  ['one', 'a'],
  ['1', 'a'],
  ['uno', 'a'],
  ['primero', 'a'],
  ['primera', 'a'],
  ['un', 'a'],
  ['premier', 'a'],
  ['premiere', 'a'],
  ['première', 'a'],
  ['second', 'b'],
  ['second option', 'b'],
  ['two', 'b'],
  ['2', 'b'],
  ['dos', 'b'],
  ['segundo', 'b'],
  ['segunda', 'b'],
  ['deux', 'b'],
  ['deuxieme', 'b'],
  ['deuxième', 'b'],
  ['third', 'c'],
  ['three', 'c'],
  ['3', 'c'],
  ['tres', 'c'],
  ['très', 'c'],
  ['tercero', 'c'],
  ['tercera', 'c'],
  ['trois', 'c'],
  ['troisieme', 'c'],
  ['troisième', 'c'],
  ['fourth', 'd'],
  ['four', 'd'],
  ['4', 'd'],
  ['cuatro', 'd'],
  ['cuarto', 'd'],
  ['cuarta', 'd'],
  ['quatre', 'd'],
  ['quatrieme', 'd'],
  ['quatrième', 'd'],
]);

const LETTER_WORDS = new Map([
  ['a', 'a'],
  ['ay', 'a'],
  ['hey', 'a'],
  ['b', 'b'],
  ['bee', 'b'],
  ['be', 'b'],
  ['c', 'c'],
  ['see', 'c'],
  ['sea', 'c'],
  ['d', 'd'],
  ['dee', 'd'],
]);

export function normalizeVoiceTranscript(transcript) {
  return String(transcript || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeVoiceTranscript(text).split(' ').filter(Boolean);
}

function optionFromLetterPhrase(normalized) {
  const patterns = [
    /^(?:option|answer|choice|letter|respuesta|opcion|opcion|reponse|réponse|choix)\s+([abcd])$/,
    /^([abcd])$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1];
  }

  const tokens = tokenize(normalized);
  for (const token of tokens) {
    if (LETTER_WORDS.has(token)) return LETTER_WORDS.get(token);
  }

  return null;
}

function optionFromOrdinal(normalized) {
  if (ORDINAL_MAP.has(normalized)) return ORDINAL_MAP.get(normalized);

  for (const [phrase, option] of ORDINAL_MAP.entries()) {
    if (normalized.includes(phrase)) return option;
  }

  return null;
}

function optionFromAnswerText(normalized, options) {
  const matches = [];

  for (const option of OPTION_LETTERS) {
    const optionText = normalizeVoiceTranscript(options?.[option] || '');
    if (!optionText || optionText.length < 4) continue;

    if (normalized === optionText || normalized.includes(optionText) || optionText.includes(normalized)) {
      matches.push(option);
      continue;
    }

    const optionTokens = new Set(tokenize(optionText).filter((token) => token.length > 3));
    const transcriptTokens = tokenize(normalized).filter((token) => token.length > 3);
    const overlap = transcriptTokens.filter((token) => optionTokens.has(token)).length;
    if (overlap >= Math.min(2, optionTokens.size)) matches.push(option);
  }

  return [...new Set(matches)];
}

export function matchVoiceAnswer(transcript, options = {}) {
  const normalized = normalizeVoiceTranscript(transcript);
  if (!normalized) {
    return { transcript: '', option: null, confidence: 'none', ambiguous: false };
  }

  const explicitOption = optionFromLetterPhrase(normalized) || optionFromOrdinal(normalized);
  if (explicitOption) {
    return { transcript: normalized, option: explicitOption, confidence: 'high', ambiguous: false };
  }

  const textMatches = optionFromAnswerText(normalized, options);
  if (textMatches.length === 1) {
    return { transcript: normalized, option: textMatches[0], confidence: 'medium', ambiguous: false };
  }

  if (textMatches.length > 1) {
    return {
      transcript: normalized,
      option: null,
      suggestedOption: textMatches[0],
      confidence: 'low',
      ambiguous: true,
    };
  }

  return { transcript: normalized, option: null, confidence: 'none', ambiguous: false };
}
