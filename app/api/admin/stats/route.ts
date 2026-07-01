import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [questionsRes, flashRes, vigRes, usersRes, subsRes, pendingRes] = await Promise.all([
      supabaseAdmin.from('questions').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('flashcards').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('case_vignettes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('questions').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    ]);

    const error = questionsRes.error || flashRes.error || vigRes.error || usersRes.error || subsRes.error || pendingRes.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      questions: questionsRes.count || 0,
      flashcards: flashRes.count || 0,
      vignettes: vigRes.count || 0,
      users: usersRes.count || 0,
      subscriptions: subsRes.count || 0,
      pendingReview: pendingRes.count || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
