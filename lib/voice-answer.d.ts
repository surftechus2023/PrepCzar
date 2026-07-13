export type VoiceOption = 'a' | 'b' | 'c' | 'd';

export type VoiceAnswerMatch = {
  transcript: string;
  option: VoiceOption | null;
  suggestedOption?: VoiceOption;
  confidence: 'high' | 'medium' | 'low' | 'none';
  ambiguous: boolean;
};

export function normalizeVoiceTranscript(transcript: string): string;

export function matchVoiceAnswer(
  transcript: string,
  options?: Partial<Record<VoiceOption, string>>,
): VoiceAnswerMatch;
