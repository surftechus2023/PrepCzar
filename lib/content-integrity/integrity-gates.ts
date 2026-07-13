import type { Question } from '@/types/database';

export const INTEGRITY_THRESHOLDS = {
  blueprintAlignment: 90,
  difficultyQuality: 80,
  overallIntegrity: 85,
  highDuplicateRisk: 70,
} as const;

export function hasCriticalBiasFlags(flags: unknown) {
  if (!Array.isArray(flags)) return false;
  return flags.some((flag) => /\b(critical|unresolved|stereotyp|stigmatizing|discriminatory)\b/i.test(String(flag)));
}

export function questionPassesIntegrityGate(question: Pick<
  Question,
  | 'integrity_status'
  | 'difficulty'
  | 'blueprint_alignment_score'
  | 'difficulty_quality_score'
  | 'integrity_score'
  | 'plagiarism_risk_score'
  | 'bias_flags'
>) {
  return question.integrity_status === 'passed'
    && question.difficulty !== 'easy'
    && (question.blueprint_alignment_score ?? 0) >= INTEGRITY_THRESHOLDS.blueprintAlignment
    && (question.difficulty_quality_score ?? 0) >= INTEGRITY_THRESHOLDS.difficultyQuality
    && (question.integrity_score ?? 0) >= INTEGRITY_THRESHOLDS.overallIntegrity
    && (question.plagiarism_risk_score ?? 0) <= INTEGRITY_THRESHOLDS.highDuplicateRisk
    && !hasCriticalBiasFlags(question.bias_flags);
}
