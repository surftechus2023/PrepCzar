import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function isMissingColumn(errorMessage: string | undefined) {
  const message = (errorMessage || '').toLowerCase();
  return message.includes('column') || message.includes('schema cache');
}

const QUESTION_SELECT = '*, exam_track:exam_tracks(name, slug, official_source_url, official_exam_description, aswb_exam_level), topic:topics(title, description, official_blueprint_text, official_weight_percent), subtopic_record:subtopics(title, description, learning_objective, official_blueprint_text), social_work_blueprint_item:social_work_blueprint_items(id, exam_level, major_content_area, percentage_weight, competency_section, applied_knowledge_statement, cognitive_level_guidance, official_blueprint_text, sample_style_guidance), question_revisions(id, revision_number, revision_type, failure_reasons, improvement_notes, model_used, created_at), question_committee_reviews(id, reviewer_role, model_used, vote, score, reason, required_changes, created_at)';

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const pendingAi = searchParams.get('pendingAi') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || (pendingAi ? 100 : 50))));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const supabaseAdmin = getSupabaseAdmin();

    let questionsQuery = supabaseAdmin
      .from('questions')
      .select(QUESTION_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (pendingAi) {
      questionsQuery = questionsQuery
        .eq('reviewed', false)
        .or('generated_by_ai.eq.true,import_batch_id.not.is.null');
    }

    let { data: questions, error: questionsError, count: questionsCount } = await questionsQuery;

    if (pendingAi && questionsError && isMissingColumn(questionsError.message)) {
      const fallback = await supabaseAdmin
        .from('questions')
        .select(QUESTION_SELECT, { count: 'exact' })
        .eq('reviewed', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      questions = fallback.data;
      questionsError = fallback.error;
      questionsCount = fallback.count;
    }

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const { data: tracks, error: tracksError } = await supabaseAdmin
      .from('exam_tracks')
      .select('*')
      .order('name');

    if (tracksError) {
      return NextResponse.json({ error: tracksError.message }, { status: 500 });
    }

    return NextResponse.json({
      questions: questions || [],
      tracks: tracks || [],
      pagination: {
        page,
        limit,
        total: questionsCount || 0,
        hasMore: (questions || []).length === limit,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, values } = await req.json();
    if (!id || !values || typeof values !== 'object') {
      return NextResponse.json({ error: 'Invalid update request' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabaseAdmin
      .from('questions')
      .select('reviewed, active, integrity_status, integrity_override, admin_override, blueprint_alignment_score, difficulty_quality_score, integrity_score, committee_status, difficulty, plagiarism_risk_score')
      .eq('id', id)
      .single();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const updateValues = { ...values };
    if (updateValues.integrity_override === true) {
      if (!String(updateValues.integrity_override_reason || '').trim()) {
        return NextResponse.json({ error: 'Integrity override reason is required.' }, { status: 400 });
      }
      updateValues.integrity_override_by = adminUser.id;
      updateValues.integrity_override_at = new Date().toISOString();
      updateValues.admin_override = true;
      updateValues.admin_override_reason = updateValues.integrity_override_reason;
      updateValues.admin_override_by = adminUser.id;
      updateValues.admin_override_at = updateValues.integrity_override_at;
    }

    const nextReviewed = updateValues.reviewed ?? current.reviewed;
    const nextActive = updateValues.active ?? current.active;
    const nextIntegrityStatus = updateValues.integrity_status ?? current.integrity_status;
    const nextIntegrityOverride = updateValues.integrity_override ?? current.integrity_override;
    const nextAdminOverride = updateValues.admin_override ?? current.admin_override;
    const nextCommitteeStatus = updateValues.committee_status ?? current.committee_status;
    const nextBlueprintScore = updateValues.blueprint_alignment_score ?? current.blueprint_alignment_score;
    const nextDifficultyScore = updateValues.difficulty_quality_score ?? current.difficulty_quality_score;
    const nextIntegrityScore = updateValues.integrity_score ?? current.integrity_score;
    const nextDifficulty = updateValues.difficulty ?? current.difficulty;
    const nextPlagiarismRiskScore = updateValues.plagiarism_risk_score ?? current.plagiarism_risk_score;
    const overridePublish = nextIntegrityOverride === true || nextAdminOverride === true;
    const passedPublicationGate = nextIntegrityStatus === 'passed'
      && nextCommitteeStatus === 'approved'
      && nextBlueprintScore >= 90
      && nextDifficultyScore >= 80
      && nextIntegrityScore >= 85
      && nextDifficulty !== 'easy'
      && nextPlagiarismRiskScore <= 70;

    if (
      nextActive === true
      && (
        !nextReviewed
        || (!overridePublish && !passedPublicationGate)
      )
    ) {
      return NextResponse.json(
        { error: 'Questions can only be published after passed integrity, final thresholds, committee approval, and review, unless an admin override is recorded.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('questions')
      .update(updateValues)
      .eq('id', id)
      .select(QUESTION_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ question: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing question id' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
