import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlueprintContext {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  socialWorkBlueprintItemId?: string | null;
  blueprintDomainId?: string | null;
  blueprintCompetencyId?: string | null;
  blueprintObjectiveId?: string | null;
  cacrepCoreAreas: string[];
  blueprintVersion: string;
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
      .select('id, name, full_name, slug, official_source_url, official_exam_description, aswb_exam_level, exam_level')
      .eq('id', input.examTrackId)
      .single(),
    supabaseAdmin
      .from('topics')
      .select('id, title, description, official_blueprint_text, official_weight_percent, blueprint_domain_id')
      .eq('id', input.topicId)
      .eq('exam_track_id', input.examTrackId)
      .single(),
  ]);

  if (trackRes.error || !trackRes.data) throw new Error(trackRes.error?.message || 'Exam track not found.');
  if (topicRes.error || !topicRes.data) throw new Error(topicRes.error?.message || 'Topic not found.');
  let topic = topicRes.data;

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

  if (blueprintItem?.topic_id && !text(topic.official_blueprint_text)) {
    const { data, error } = await supabaseAdmin
      .from('topics')
      .select('id, title, description, official_blueprint_text, official_weight_percent, blueprint_domain_id')
      .eq('id', blueprintItem.topic_id)
      .eq('exam_track_id', input.examTrackId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.official_blueprint_text) topic = data;
  }

  let subtopic: any = null;
  const effectiveSubtopicId = input.subtopicId || blueprintItem?.subtopic_id || null;
  if (effectiveSubtopicId) {
    const { data, error } = await supabaseAdmin
      .from('subtopics')
      .select('id, title, description, learning_objective, official_blueprint_text, blueprint_competency_id, blueprint_objective_id')
      .eq('id', effectiveSubtopicId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    subtopic = data;
  }

  let domain: any = null;
  let competency: any = null;
  let objective: any = null;
  let cacrepCoreAreas: string[] = [];

  if (topic.blueprint_domain_id) {
    const { data, error } = await supabaseAdmin
      .from('blueprint_domains')
      .select('id, code, title, description, official_blueprint_text, weight_percent, active, is_placeholder')
      .eq('id', topic.blueprint_domain_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    domain = data;
  }

  if (subtopic?.blueprint_competency_id) {
    const { data, error } = await supabaseAdmin
      .from('blueprint_competencies')
      .select('id, code, title, description, official_blueprint_text, active, is_placeholder')
      .eq('id', subtopic.blueprint_competency_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    competency = data;
  }

  if (subtopic?.blueprint_objective_id) {
    const { data, error } = await supabaseAdmin
      .from('blueprint_objectives')
      .select('id, code, title, description, official_blueprint_text, learning_objective, active, is_placeholder')
      .eq('id', subtopic.blueprint_objective_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    objective = data;

    const { data: mappings, error: mappingsError } = await (supabaseAdmin as any)
      .from('blueprint_objective_cacrep_mappings')
      .select('cacrep_core_area:cacrep_core_areas(title)')
      .eq('objective_id', subtopic.blueprint_objective_id);

    if (mappingsError && !/schema cache|does not exist|could not find|relation/i.test(mappingsError.message)) {
      throw new Error(mappingsError.message);
    }

    cacrepCoreAreas = ((mappings || []) as any[])
      .map((mapping) => mapping.cacrep_core_area?.title)
      .filter(Boolean);
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
    topicId: topic.id,
    subtopicId: subtopic?.id || effectiveSubtopicId,
    socialWorkBlueprintItemId: blueprintItem?.id || null,
    blueprintDomainId: domain?.id || topic.blueprint_domain_id || null,
    blueprintCompetencyId: competency?.id || subtopic?.blueprint_competency_id || null,
    blueprintObjectiveId: objective?.id || subtopic?.blueprint_objective_id || null,
    cacrepCoreAreas,
    blueprintVersion: isSocialWorkTrack(`${trackName} ${trackRes.data.slug || ''}`) ? 'ASWB-stored-blueprint' : trackRes.data.slug === 'nce' ? 'NCE-uploaded-blueprint-2026' : 'stored-blueprint',
    examTrack: trackName,
    officialExamDescription: text(trackRes.data.official_exam_description),
    officialSourceURL: text(trackRes.data.official_source_url),
    aswbExamLevel: text(trackRes.data.aswb_exam_level) || text(blueprintItem?.exam_level) || text(trackRes.data.exam_level),
    majorContentArea: text(blueprintItem?.major_content_area) || text(domain?.title) || text(topic.title),
    majorContentWeight: blueprintItem?.percentage_weight ?? domain?.weight_percent ?? topic.official_weight_percent ?? null,
    competencySection: text(blueprintItem?.competency_section) || text(competency?.title) || text(subtopic?.title),
    appliedKnowledgeStatement: text(blueprintItem?.applied_knowledge_statement) || text(objective?.title) || text(subtopic?.learning_objective),
    learningObjective: text(blueprintItem?.applied_knowledge_statement) || text(objective?.learning_objective) || text(subtopic?.learning_objective),
    topicDescription: text(domain?.description) || text(topic.description),
    subtopicDescription: text(competency?.description) || text(subtopic?.description),
    topicOfficialBlueprintText: text(domain?.official_blueprint_text) || text(topic.official_blueprint_text),
    subtopicOfficialBlueprintText: text(objective?.official_blueprint_text) || text(competency?.official_blueprint_text) || text(subtopic?.official_blueprint_text),
    officialBlueprintText: [
      text(blueprintItem?.official_blueprint_text),
      text(objective?.official_blueprint_text),
      text(competency?.official_blueprint_text),
      text(domain?.official_blueprint_text),
      text(subtopic?.official_blueprint_text),
      text(topic.official_blueprint_text),
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
    ['exam level', context.aswbExamLevel],
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

  if (domain?.is_placeholder) context.missingMetadata.push('official domain blueprint metadata');
  if (competency?.is_placeholder) context.missingMetadata.push('official competency blueprint metadata');
  if (objective?.is_placeholder) context.missingMetadata.push('official objective blueprint metadata');
  if (domain && domain.active === false) context.missingMetadata.push('active blueprint domain');
  if (competency && competency.active === false) context.missingMetadata.push('active blueprint competency');
  if (objective && objective.active === false) context.missingMetadata.push('active blueprint objective');

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
- CACREP core area mapping: ${context.cacrepCoreAreas.join(', ') || 'MISSING'}
- Blueprint version: ${context.blueprintVersion}
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
