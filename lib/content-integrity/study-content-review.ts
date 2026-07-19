import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAIModelSetting, logAIUsage } from '@/lib/ai/model-settings';
import { getOpenAIClient } from '@/lib/openai/client';
import { temperatureOption } from '@/lib/openai/request-options';

type ReviewStatus = 'passed' | 'needs_improvement' | 'needs_metadata' | 'failed';
type ContentKind = 'flashcard' | 'case_vignette';

const reviewSchema = z.object({
  blueprint_alignment_score: z.number().min(0).max(100),
  difficulty_quality_score: z.number().min(0).max(100),
  content_quality_score: z.number().min(0).max(100),
  bias_score: z.number().min(0).max(100),
  integrity_score: z.number().min(0).max(100),
  integrity_status: z.enum(['passed', 'needs_improvement', 'needs_metadata', 'failed']).optional(),
  quality_flags: z.array(z.string()).default([]),
  review_notes: z.string().min(1),
});

export type StudyContentReviewResult = z.infer<typeof reviewSchema> & {
  integrity_status: ReviewStatus;
  model_used: string;
};

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStatus(result: z.infer<typeof reviewSchema>): ReviewStatus {
  if (result.integrity_status === 'needs_metadata') return 'needs_metadata';
  if (
    result.blueprint_alignment_score >= 85 &&
    result.difficulty_quality_score >= 80 &&
    result.content_quality_score >= 80 &&
    result.bias_score >= 80 &&
    result.integrity_score >= 85
  ) {
    return 'passed';
  }
  return 'needs_improvement';
}

function parseReviewContent(content: string) {
  const parsed = reviewSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(`AI review response failed validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function fetchBlueprintContext(supabaseAdmin: SupabaseClient, item: any) {
  const [trackRes, topicRes, subtopicRes, domainRes, competencyRes, objectiveRes, guidelineRes] = await Promise.all([
    item.exam_track_id
      ? supabaseAdmin.from('exam_tracks').select('id, name, full_name, slug, official_source_url, official_exam_description, exam_level, aswb_exam_level').eq('id', item.exam_track_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.topic_id
      ? supabaseAdmin.from('topics').select('id, title, description, official_blueprint_text, official_weight_percent').eq('id', item.topic_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.subtopic_id
      ? supabaseAdmin.from('subtopics').select('id, title, description, learning_objective, official_blueprint_text').eq('id', item.subtopic_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.blueprint_domain_id
      ? supabaseAdmin.from('blueprint_domains').select('id, code, title, description, official_blueprint_text, weight_percent').eq('id', item.blueprint_domain_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.blueprint_competency_id
      ? supabaseAdmin.from('blueprint_competencies').select('id, code, title, description, official_blueprint_text').eq('id', item.blueprint_competency_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.blueprint_objective_id
      ? supabaseAdmin.from('blueprint_objectives').select('id, code, title, description, official_blueprint_text, learning_objective').eq('id', item.blueprint_objective_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    item.exam_track_id
      ? supabaseAdmin.from('question_blueprint_guidelines').select('question_style_guideline, allowed_question_types, prohibited_question_types, difficulty_rules').eq('exam_track_id', item.exam_track_id).eq('cognitive_level', item.cognitive_level || 'application').maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  const errors = [trackRes.error, topicRes.error, subtopicRes.error, domainRes.error, competencyRes.error, objectiveRes.error, guidelineRes.error]
    .filter((error: any) => error && !/schema cache|does not exist|could not find/i.test(error.message));
  if (errors.length) throw new Error(errors[0].message);

  return {
    examTrack: trackRes.data,
    topic: topicRes.data,
    subtopic: subtopicRes.data,
    domain: domainRes.data,
    competency: competencyRes.data,
    objective: objectiveRes.data,
    guideline: guidelineRes.data,
  };
}

function metadataIsMissing(item: any, context: Awaited<ReturnType<typeof fetchBlueprintContext>>) {
  return !context.examTrack ||
    !hasText(context.examTrack.official_exam_description) ||
    !hasText(context.examTrack.official_source_url) ||
    !hasText(context.domain?.official_blueprint_text || context.topic?.official_blueprint_text || item.blueprint_reference_text) ||
    !hasText(context.objective?.learning_objective || context.subtopic?.learning_objective || item.learning_objective);
}

function formatContext(item: any, context: Awaited<ReturnType<typeof fetchBlueprintContext>>) {
  return {
    exam_track: context.examTrack?.full_name || context.examTrack?.name || item.exam_name || 'Not provided',
    exam_level: context.examTrack?.exam_level || context.examTrack?.aswb_exam_level || 'Not provided',
    official_source_url: context.examTrack?.official_source_url || 'Not provided',
    official_exam_description: context.examTrack?.official_exam_description || 'Not provided',
    domain: context.domain?.title || context.topic?.title || item.source_topic || 'Not provided',
    domain_weight: context.domain?.weight_percent ?? context.topic?.official_weight_percent ?? null,
    competency: context.competency?.title || context.subtopic?.title || 'Not provided',
    applied_knowledge_statement: context.objective?.title || item.learning_objective || 'Not provided',
    topic: context.topic?.title || item.source_topic || 'Not provided',
    topic_description: context.topic?.description || 'Not provided',
    subtopic: context.subtopic?.title || 'Not provided',
    subtopic_description: context.subtopic?.description || 'Not provided',
    learning_objective: context.objective?.learning_objective || context.subtopic?.learning_objective || item.learning_objective || 'Not provided',
    official_blueprint_text: [
      context.objective?.official_blueprint_text,
      context.competency?.official_blueprint_text,
      context.domain?.official_blueprint_text,
      context.subtopic?.official_blueprint_text,
      context.topic?.official_blueprint_text,
      item.blueprint_reference_text,
    ].filter(hasText).join('\n\n') || 'Not provided',
    question_writing_guideline: context.guideline?.question_style_guideline || 'Not provided',
    intended_difficulty: item.difficulty || 'medium',
    intended_cognitive_level: item.cognitive_level || 'application',
  };
}

function contentPayload(kind: ContentKind, item: any) {
  if (kind === 'flashcard') {
    return {
      front_en: item.front_en,
      back_en: item.back_en,
      front_es: item.front_es,
      front_fr: item.front_fr,
      back_es: item.back_es,
      back_fr: item.back_fr,
    };
  }

  return {
    case_en: item.case_en,
    prompt_en: item.prompt_en,
    expected_answer_elements: item.expected_answer_elements,
    scoring_rubric: item.scoring_rubric,
    ideal_answer_en: item.ideal_answer_en,
    coaching_feedback_en: item.coaching_feedback_en,
  };
}

function reviewPrompt(kind: ContentKind, item: any, context: Awaited<ReturnType<typeof fetchBlueprintContext>>) {
  const contentName = kind === 'flashcard' ? 'flashcard' : 'case vignette';
  const extraCriteria = kind === 'flashcard'
    ? [
        'Flashcard front must be clear, focused, and answerable.',
        'Flashcard back must be complete, accurate, and educational.',
        'Reject vague front/back pairs that are too generic for the selected blueprint.',
      ]
    : [
        'Case scenario must be realistic and exam-track appropriate.',
        'Prompt, expected answer elements, scoring rubric, ideal answer, and coaching feedback must align.',
        'Reject cases with missing rubric logic, weak coaching feedback, or unsafe professional sequencing.',
      ];

  return `Review this ${contentName} using only the stored blueprint context supplied below.
Do not judge from generic model knowledge if metadata is missing.

Required status rules:
- passed only if blueprint_alignment_score >= 85, difficulty_quality_score >= 80, content_quality_score >= 80, bias_score >= 80, and integrity_score >= 85.
- needs_metadata if required blueprint source, exam description, blueprint text, or learning objective is missing.
- needs_improvement if aligned but too generic, too easy, unclear, incomplete, biased, or weak.

Difficulty rule:
- Easy generated study content is not acceptable.
- Medium must require application.
- Hard must require reasoning, prioritization, clinical/professional judgment, ethical analysis, risk assessment, differential diagnosis, or complex decision-making where appropriate.

Criteria:
- Blueprint alignment
- Exam-track appropriateness
- Difficulty and cognitive-level match
- Clarity and professional scope
- Bias and fairness
- Originality risk and over-generic wording
- Stored rationale/feedback quality
${extraCriteria.map((criterion) => `- ${criterion}`).join('\n')}

Blueprint context:
${JSON.stringify(formatContext(item, context), null, 2)}

Content:
${JSON.stringify(contentPayload(kind, item), null, 2)}

Return only valid JSON:
{
  "blueprint_alignment_score": 0,
  "difficulty_quality_score": 0,
  "content_quality_score": 0,
  "bias_score": 0,
  "integrity_score": 0,
  "integrity_status": "passed",
  "quality_flags": ["string"],
  "review_notes": "string"
}`;
}

async function reviewStudyContent(input: {
  supabaseAdmin: SupabaseClient;
  item: any;
  kind: ContentKind;
  adminUserId?: string | null;
}) {
  const context = await fetchBlueprintContext(input.supabaseAdmin, input.item);
  const model = await resolveAIModelSetting(input.supabaseAdmin, 'integrity_review');

  if (metadataIsMissing(input.item, context)) {
    return {
      blueprint_alignment_score: 0,
      difficulty_quality_score: 0,
      content_quality_score: 0,
      bias_score: 100,
      integrity_score: 0,
      integrity_status: 'needs_metadata' as ReviewStatus,
      quality_flags: ['missing_blueprint_metadata'],
      review_notes: 'Missing blueprint metadata required for AI integrity review.',
      model_used: model.model_name,
    };
  }

  const openai = getOpenAIClient();
  try {
    const completion = await openai.chat.completions.create({
      model: model.model_name,
      ...temperatureOption(model.model_name, 0.2),
      messages: [
        { role: 'system', content: 'You are a rigorous exam-prep integrity reviewer. Output only valid JSON.' },
        { role: 'user', content: reviewPrompt(input.kind, input.item, context) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned no review content.');

    const parsed = parseReviewContent(content);
    const integrityStatus = normalizeStatus(parsed);

    await logAIUsage(input.supabaseAdmin, {
      actionType: 'integrity_review',
      modelName: model.model_name,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      relatedRecordId: input.item.id,
      adminUserId: input.adminUserId || null,
      success: true,
    });

    return {
      ...parsed,
      integrity_status: integrityStatus,
      model_used: model.model_name,
    };
  } catch (error: any) {
    await logAIUsage(input.supabaseAdmin, {
      actionType: 'integrity_review',
      modelName: model.model_name,
      relatedRecordId: input.item.id,
      adminUserId: input.adminUserId || null,
      success: false,
      errorMessage: error.message,
    });
    throw error;
  }
}

export async function reviewFlashcardIntegrity(input: {
  supabaseAdmin: SupabaseClient;
  flashcard: any;
  adminUserId?: string | null;
}) {
  return reviewStudyContent({
    supabaseAdmin: input.supabaseAdmin,
    item: input.flashcard,
    kind: 'flashcard',
    adminUserId: input.adminUserId,
  });
}

export async function reviewVignetteIntegrity(input: {
  supabaseAdmin: SupabaseClient;
  vignette: any;
  adminUserId?: string | null;
}) {
  return reviewStudyContent({
    supabaseAdmin: input.supabaseAdmin,
    item: input.vignette,
    kind: 'case_vignette',
    adminUserId: input.adminUserId,
  });
}
