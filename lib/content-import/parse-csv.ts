import type { ImportedContentType, ParsedImportItem } from './types';
import { parseTextContent } from './parse-text';

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseCsvContent(text: string, contentType: ImportedContentType): ParsedImportItem[] {
  const rows = parseCsvRows(text);
  const [headers, ...dataRows] = rows;
  if (!headers?.length) return [];
  const normalizedHeaders = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const blocks = dataRows.map((row) => {
    const record = Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index] || '']));
    if (contentType === 'mcq') {
      return `Question: ${record.question || record.stem || ''}\nA. ${record.option_a || record.a || ''}\nB. ${record.option_b || record.b || ''}\nC. ${record.option_c || record.c || ''}\nD. ${record.option_d || record.d || ''}\nAnswer: ${record.answer || record.correct_option || ''}\nRationale: ${record.rationale || record.correct_rationale || ''}`;
    }
    if (contentType === 'flashcards') {
      return `Front: ${record.front || record.question || ''}\nBack: ${record.back || record.answer || ''}`;
    }
    return `Case: ${record.case || record.scenario || ''}\nPrompt: ${record.prompt || ''}\nIdeal answer: ${record.ideal_answer || record.answer || ''}\nCoaching feedback: ${record.coaching_feedback || record.feedback || ''}`;
  });
  return parseTextContent(blocks.join('\n---\n'), contentType);
}
