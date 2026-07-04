import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlueprintContext {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  socialWorkBlueprintItemId?: string | null;
  examTrack: string;
  officialExamDescription: string;
  officialSourceURL: string;
  aswbExamLevel: string;
  majorContentArea: string;
  majorContentWeight: number | null;
  competencySection: string;
  appliedKnowledgeStatement: string;
  learningObjective: string;
  topicDescription: string;
  subtopicDescription: string;
  topicOfficialBlueprintText: string;
  subtopicOfficialBlueprintText: string;
  officialBlueprintText: string;
  difficultyTarget: 'medium' | 'hard';
  cognitiveLevelTarget: string;
  questionWritingGuidelines: string;
  prohibitedQuestionTypes: string[];
  allowedQuestionTypes: string[];
  difficultyRules: Record<string, unknown>;
  missingMetadata: string[];
}

interface BuildBlueprintContextInput {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  socialWorkBlueprintItemId?: string | null;
  difficultyTarget?: string | null;
  cognitiveLevelTarget?: string | null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mediumOrHard(value: string | null | undefined): 'medium' | 'hard' {
  return value === 'hard' ? 'hard' : 'medium';
}

function normalizeCognitiveLevel(value: string | null | undefined) {
  const normalized = text(value).toLowerCase();
  return normalized && normalized !== 'recall' && normalized !== 'comprehension'
    ? normalized
    : 'application';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function isSocialWorkTrack(value: string) {
  return /\b(bsw|msw|lmsw|lcsw|social work|clinical social)\b/i.test(value);
}

export async function buildBlueprintContext(
  supabaseAdmin: SupabaseClient,
  input: BuildBlueprintContextInput
): Promise<BlueprintContext> {
  const [trackRes, topicRes] = await Promise.all([
    supabaseAdmin
      .from('exam_tracks')
      .select('id, name, full_name, slug, official_source_url, official_exam_description, aswb_exam_level')
      .eq('id', input.examTrackId)
      .single(),
    supabaseAdmin
      .from('topics')
      .select('id, title, description, official_blueprint_text, official_weight_percent')
      .eq('id', input.topicId)
      .eq('exam_track_id', input.examTrackId)
      .single(),
  ]);

  if (trackRes.error || !trackRes.data) throw new Error(trackRes.error?.message || 'Exam track not found.');
  if (topicRes.error || !topicRes.data) throw new Error(topicRes.error?.message || 'Topic not found.');

  let blueprintItem: any = null;
  if (input.socialWorkBlueprintItemId) {
    const { data, error } = await supabaseAdmin
      .from('social_work_blueprint_items')
      .select('*')
      .eq('id', input.socialWorkBlueprintItemId)
      .eq('exam_track_id', input.examTrackId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    blueprintItem = data;
  }

  let subtopic: any = null;
  const effectiveSubtopicId = input.subtopicId || blueprintItem?.subtopic_id || null;
  if (effectiveSubtopicId) {
    const { data, error } = await supabaseAdmin
      .from('subtopics')
      .select('id, title, description, learning_objective, official_blueprint_text')
      .eq('id', effectiveSubtopicId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    subtopic = data;
  }

  const cognitiveLevelTarget = normalizeCognitiveLevel(input.cognitiveLevelTarget);
  const { data: guideline, error: guidelineError } = await supabaseAdmin
    .from('question_blueprint_guidelines')
    .select('question_style_guideline, allowed_question_types, prohibited_question_types, difficulty_rules')
    .eq('exam_track_id', input.examTrackId)
    .eq('cognitive_level', cognitiveLevelTarget)
    .maybeSingle();

  if (guidelineError) throw new Error(guidelineError.message);

  const trackName = text(trackRes.data.full_name) || text(trackRes.data.name);
  const context: BlueprintContext = {
    examTrackId: input.examTrackId,
    topicId: input.topicId,
    subtopicId: subtopic?.id || effectiveSubtopicId,
    socialWorkBlueprintItemId: blueprintItem?.id || null,
    examTrack: trackName,
    officialExamDescription: text(trackRes.data.official_exam_description),
    officialSourceURL: text(trackRes.data.official_source_url),
    aswbExamLevel: text(trackRes.data.aswb_exam_level) || text(blueprintItem?.exam_level),
    majorContentArea: text(blueprintItem?.major_content_area) || text(topicRes.data.title),
    majorContentWeight: blueprintItem?.percentage_weight ?? topicRes.data.official_weight_percent ?? null,
    competencySection: text(blueprintItem?.competency_section) || text(subtopic?.title),
    appliedKnowledgeStatement: text(blueprintItem?.applied_knowledge_statement) || text(subtopic?.learning_objective),
    learningObjective: text(blueprintItem?.applied_knowledge_statement) || text(subtopic?.learning_objective),
    topicDescription: text(topicRes.data.description),
    subtopicDescription: text(subtopic?.description),
    topicOfficialBlueprintText: text(topicRes.data.official_blueprint_text),
    subtopicOfficialBlueprintText: text(subtopic?.official_blueprint_text),
    officialBlueprintText: [
      text(blueprintItem?.official_blueprint_text),
      text(subtopic?.official_blueprint_text),
      text(topicRes.data.official_blueprint_text),
    ].filter(Boolean).join('\n\n'),
    difficultyTarget: mediumOrHard(input.difficultyTarget),
    cognitiveLevelTarget,
    questionWritingGuidelines: text(blueprintItem?.sample_style_guidance) || text(guideline?.question_style_guideline),
    prohibitedQuestionTypes: asStringArray(guideline?.prohibited_question_types),
    allowedQuestionTypes: asStringArray(guideline?.allowed_question_types),
    difficultyRules: typeof guideline?.difficulty_rules === 'object' && guideline?.difficulty_rules
      ? guideline.difficulty_rules as Record<string, unknown>
      : {},
    missingMetadata: [],
  };

  const requiredFields: Array<[string, string | number | null]> = [
    ['official source URL', context.officialSourceURL],
    ['exam description', context.officialExamDescription],
    ['ASWB exam level', context.aswbExamLevel],
    ['major content area', context.majorContentArea],
    ['content weight', context.majorContentWeight],
    ['competency section', context.competencySection],
    ['applied knowledge statement', context.appliedKnowledgeStatement],
    ['learning objective', context.learningObjective],
    ['topic blueprint text', context.topicOfficialBlueprintText],
    ['blueprint reference text', context.officialBlueprintText],
    ['question-writing guideline', context.questionWritingGuidelines],
  ];

  context.missingMetadata = requiredFields
    .filter(([, value]) => value === null || value === undefined || String(value).trim() === '')
    .map(([field]) => field);

  if (isSocialWorkTrack(`${trackName} ${trackRes.data.slug || ''}`) && !context.socialWorkBlueprintItemId) {
    context.missingMetadata.push('Social Work applied knowledge statement');
  }

  return context;
}

export function formatBlueprintContextForPrompt(context: BlueprintContext) {
  return `BlueprintContext:
- Exam track: ${context.examTrack}
- Official source URL: ${context.officialSourceURL || 'MISSING'}
- Official exam description: ${context.officialExamDescription || 'MISSING'}
- ASWB exam level: ${context.aswbExamLevel || 'MISSING'}
- Major content area: ${context.majorContentArea || 'MISSING'}
- Content weight: ${context.majorContentWeight ?? 'MISSING'}
- Competency section: ${context.competencySection || 'MISSING'}
- Applied knowledge statement: ${context.appliedKnowledgeStatement || 'MISSING'}
- Learning objective: ${context.learningObjective || 'MISSING'}
- Topic description: ${context.topicDescription || 'MISSING'}
- Subtopic description: ${context.subtopicDescription || 'MISSING'}
- Topic blueprint text: ${context.topicOfficialBlueprintText || 'MISSING'}
- Subtopic blueprint text: ${context.subtopicOfficialBlueprintText || 'MISSING'}
- Official blueprint reference text: ${context.officialBlueprintText || 'MISSING'}
- Difficulty target: ${context.difficultyTarget}
- Cognitive level target: ${context.cognitiveLevelTarget}
- Question-writing guidelines: ${context.questionWritingGuidelines || 'MISSING'}
- Allowed question types: ${context.allowedQuestionTypes.join(', ') || 'MISSING'}
- Prohibited question types: ${context.prohibitedQuestionTypes.join(', ') || 'MISSING'}`;
}
