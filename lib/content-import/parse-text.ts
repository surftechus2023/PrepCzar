import { createHash } from 'crypto';
import type { ImportedContentType, ParsedImportItem } from './types';

function idFor(text: string) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

function sectionValue(text: string, label: string) {
  const pattern = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(Question|Front|Back|Case|Prompt|Ideal answer|Coaching feedback|Answer|Rationale|A\\.|B\\.|C\\.|D\\.)\\s*:|\\n\\s*[A-D]\\.\\s|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() || '';
}

function optionValue(text: string, option: string) {
  const pattern = new RegExp(`(?:^|\\n)\\s*${option}[\\.)]\\s*([\\s\\S]*?)(?=\\n\\s*[A-D][\\.)]\\s|\\n\\s*Answer\\s*:|\\n\\s*Rationale\\s*:|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() || '';
}

function validate(item: ParsedImportItem, required: string[]) {
  item.missingFields = required.filter((field) => !String(item.fields[field] || '').trim());
  item.validationErrors = item.missingFields.map((field) => `Missing ${field}`);
  item.confidence = Math.max(20, 100 - item.validationErrors.length * 20);
  item.include = item.validationErrors.length === 0;
  return item;
}

function splitBlocks(text: string) {
  return text
    .split(/\n\s*(?:---+|={3,}|Question\s*:|Front\s*:|Case\s*:)/i)
    .map((block, index) => {
      if (index === 0 && !/^\s*(Question|Front|Case)\s*:/i.test(block)) return block;
      const prefix = text.match(/\n\s*(Question|Front|Case)\s*:/i)?.[1];
      return block.trim() && prefix && !/^\s*(Question|Front|Case)\s*:/i.test(block) ? `${prefix}: ${block}` : block;
    })
    .map((block) => block.trim())
    .filter(Boolean);
}

export function parseTextContent(text: string, contentType: ImportedContentType): ParsedImportItem[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const blocks = splitBlocks(normalized);

  return blocks.map((block) => {
    if (contentType === 'mcq') {
      const questionText = sectionValue(block, 'Question') || block.split(/\n\s*A[\.)]\s/i)[0]?.replace(/^Question\s*:\s*/i, '').trim();
      return validate({
        id: idFor(`mcq:${block}`),
        contentType,
        originalText: block,
        confidence: 0,
        include: false,
        validationErrors: [],
        missingFields: [],
        fields: {
          question: questionText,
          option_a: optionValue(block, 'A'),
          option_b: optionValue(block, 'B'),
          option_c: optionValue(block, 'C'),
          option_d: optionValue(block, 'D'),
          correct_option: (sectionValue(block, 'Answer').match(/[A-D]/i)?.[0] || '').toLowerCase(),
          rationale: sectionValue(block, 'Rationale'),
        },
      }, ['question', 'option_a', 'option_b', 'option_c', 'correct_option']);
    }

    if (contentType === 'flashcards') {
      return validate({
        id: idFor(`flashcard:${block}`),
        contentType,
        originalText: block,
        confidence: 0,
        include: false,
        validationErrors: [],
        missingFields: [],
        fields: {
          front: sectionValue(block, 'Front'),
          back: sectionValue(block, 'Back'),
        },
      }, ['front', 'back']);
    }

    return validate({
      id: idFor(`vignette:${block}`),
      contentType,
      originalText: block,
      confidence: 0,
      include: false,
      validationErrors: [],
      missingFields: [],
      fields: {
        case: sectionValue(block, 'Case'),
        prompt: sectionValue(block, 'Prompt'),
        ideal_answer: sectionValue(block, 'Ideal answer'),
        coaching_feedback: sectionValue(block, 'Coaching feedback'),
      },
    }, ['case', 'prompt', 'ideal_answer']);
  });
}
