export interface ExamTrackGenerationRules {
  key: string;
  label: string;
  recallMaxPercent: number;
  applicationPercent: number;
  analysisPercent: number;
  clinicalJudgmentPercent?: number;
  minimumDifficultyQualityScore: number;
  preferScenarioBased: boolean;
  focusAreas: string[];
  avoid: string[];
}

const RULES: ExamTrackGenerationRules[] = [
  {
    key: 'bsw',
    label: 'BSW',
    recallMaxPercent: 40,
    applicationPercent: 40,
    analysisPercent: 20,
    minimumDifficultyQualityScore: 70,
    preferScenarioBased: false,
    focusAreas: ['foundational social work concepts', 'basic ethics', 'basic human development', 'generalist practice'],
    avoid: ['advanced independent clinical diagnosis emphasis'],
  },
  {
    key: 'msw',
    label: 'MSW/LMSW',
    recallMaxPercent: 20,
    applicationPercent: 50,
    analysisPercent: 30,
    minimumDifficultyQualityScore: 75,
    preferScenarioBased: true,
    focusAreas: ['practice application', 'assessment', 'intervention planning', 'ethics', 'supervision', 'community practice'],
    avoid: ['simple definition-only questions', 'advanced independent clinical diagnosis emphasis when not appropriate'],
  },
  {
    key: 'lmsw',
    label: 'MSW/LMSW',
    recallMaxPercent: 20,
    applicationPercent: 50,
    analysisPercent: 30,
    minimumDifficultyQualityScore: 75,
    preferScenarioBased: true,
    focusAreas: ['practice application', 'assessment', 'intervention planning', 'ethics', 'supervision', 'community practice'],
    avoid: ['simple definition-only questions', 'advanced independent clinical diagnosis emphasis when not appropriate'],
  },
  {
    key: 'lcsw',
    label: 'LCSW',
    recallMaxPercent: 5,
    applicationPercent: 35,
    analysisPercent: 35,
    clinicalJudgmentPercent: 25,
    minimumDifficultyQualityScore: 80,
    preferScenarioBased: true,
    focusAreas: ['differential diagnosis', 'assessment priority', 'intervention choice', 'ethics', 'risk and safety', 'treatment planning', 'clinical reasoning'],
    avoid: ['simple what-is questions', 'which-disorder recall questions', 'define questions', 'generic social work questions'],
  },
  {
    key: 'nclex-rn',
    label: 'NCLEX-RN',
    recallMaxPercent: 10,
    applicationPercent: 35,
    analysisPercent: 30,
    clinicalJudgmentPercent: 25,
    minimumDifficultyQualityScore: 80,
    preferScenarioBased: true,
    focusAreas: ['clinical judgment', 'safety', 'prioritization', 'delegation', 'pharmacology', 'nursing process', 'acute care', 'Next Gen NCLEX reasoning'],
    avoid: ['simple memorization unless appropriate', 'PN-scope-only framing'],
  },
  {
    key: 'nclex-pn',
    label: 'NCLEX-PN',
    recallMaxPercent: 15,
    applicationPercent: 45,
    analysisPercent: 30,
    minimumDifficultyQualityScore: 75,
    preferScenarioBased: true,
    focusAreas: ['practical nursing scope', 'safety', 'basic care', 'pharmacology basics', 'patient education', 'prioritization within PN scope', 'reporting and escalation'],
    avoid: ['RN-level delegation', 'RN-only scope decisions'],
  },
  {
    key: 'eppp',
    label: 'EPPP',
    recallMaxPercent: 15,
    applicationPercent: 45,
    analysisPercent: 40,
    minimumDifficultyQualityScore: 75,
    preferScenarioBased: true,
    focusAreas: ['applied psychology', 'ethics', 'diagnosis', 'assessment', 'intervention', 'research methods', 'biological bases', 'social and multicultural factors', 'lifespan development'],
    avoid: ['definition-only psychology trivia'],
  },
  {
    key: 'nce',
    label: 'NCE',
    recallMaxPercent: 20,
    applicationPercent: 50,
    analysisPercent: 30,
    minimumDifficultyQualityScore: 75,
    preferScenarioBased: true,
    focusAreas: ['counseling process', 'ethics', 'human growth', 'career development', 'assessment', 'group counseling', 'helping relationships', 'research and program evaluation'],
    avoid: ['generic counseling definitions when scenario application is appropriate'],
  },
  {
    key: 'ccm',
    label: 'CCM',
    recallMaxPercent: 10,
    applicationPercent: 45,
    analysisPercent: 30,
    clinicalJudgmentPercent: 15,
    minimumDifficultyQualityScore: 80,
    preferScenarioBased: true,
    focusAreas: ['case management process', 'care coordination', 'utilization management', 'ethics', 'reimbursement', 'psychosocial aspects', 'rehabilitation', 'professional practice'],
    avoid: ['generic healthcare recall questions'],
  },
];

const DEFAULT_RULES: ExamTrackGenerationRules = {
  key: 'default',
  label: 'Professional exam',
  recallMaxPercent: 20,
  applicationPercent: 45,
  analysisPercent: 35,
  minimumDifficultyQualityScore: 75,
  preferScenarioBased: true,
  focusAreas: ['exam-track-specific application', 'professional reasoning', 'ethics', 'safety where applicable'],
  avoid: ['generic recall-only questions', 'off-topic content'],
};

function normalize(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function getExamTrackRules(examTrackName: string | null | undefined) {
  const normalized = normalize(examTrackName);
  return RULES.find((rule) => normalized.includes(rule.key)) || DEFAULT_RULES;
}

export function isAdvancedScenarioTrack(examTrackName: string | null | undefined) {
  const rules = getExamTrackRules(examTrackName);
  return rules.preferScenarioBased || ['lcsw', 'nclex-rn', 'ccm'].includes(rules.key);
}

export function isRecallOnlyStem(questionText: string | null | undefined) {
  return /^(what is|which disorder|define|which term|what term|which of the following best defines|what does)\b/i.test((questionText || '').trim());
}

export function formatExamTrackRulesForPrompt(examTrackName: string | null | undefined) {
  const rules = getExamTrackRules(examTrackName);
  return [
    `Exam-track rule profile: ${rules.label}`,
    `Recall maximum: ${rules.recallMaxPercent}%`,
    `Application target: ${rules.applicationPercent}%`,
    `Analysis target: ${rules.analysisPercent}%`,
    rules.clinicalJudgmentPercent ? `Clinical judgment target: ${rules.clinicalJudgmentPercent}%` : null,
    `Minimum difficulty quality score: ${rules.minimumDifficultyQualityScore}`,
    `Prefer scenario-based items: ${rules.preferScenarioBased ? 'yes' : 'no'}`,
    `Focus areas: ${rules.focusAreas.join('; ')}`,
    `Avoid: ${rules.avoid.join('; ')}`,
  ].filter(Boolean).join('\n');
}
