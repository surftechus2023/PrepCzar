import type { ImportParseResult } from './types';

export function parsePdfBuffer(buffer: Buffer): ImportParseResult {
  const header = buffer.subarray(0, 5).toString('utf8');
  if (header !== '%PDF-') {
    throw new Error('Malformed PDF: missing PDF header.');
  }

  const raw = buffer.toString('latin1');
  const strings = Array.from(raw.matchAll(/\(([^()]{2,})\)/g))
    .map((match) => match[1].replace(/\\([nrtbf()\\])/g, '$1'))
    .filter((value) => /[A-Za-z]{2,}/.test(value));

  return {
    text: strings.join('\n').replace(/\s+\n/g, '\n').trim(),
    warnings: ['PDF text extraction is best-effort. Review preview fields before importing.'],
  };
}
