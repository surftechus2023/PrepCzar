import { inflateRawSync } from 'zlib';
import type { ImportParseResult } from './types';

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

export function parseDocxBuffer(buffer: Buffer): ImportParseResult {
  if (buffer.subarray(0, 2).toString('utf8') !== 'PK') {
    throw new Error('Malformed DOCX: missing ZIP header.');
  }

  const eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) throw new Error('Malformed DOCX: missing central directory.');

  const centralDirectorySize = readUInt32(buffer, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end && buffer.readUInt32LE(offset) === 0x02014b50) {
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (fileName === 'word/document.xml') {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xml = compression === 0 ? compressed.toString('utf8') : inflateRawSync(compressed).toString('utf8');
      const text = xml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { text, warnings: [] };
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('Malformed DOCX: word/document.xml not found.');
}
