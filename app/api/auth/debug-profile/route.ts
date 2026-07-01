import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [{ data: userRow, error: userError }, { data: profileRow, error: profileError }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id,email,role')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('id,email,role')
        .eq('id', authUser.id)
        .maybeSingle(),
    ]);

    if (userError || profileError) {
      return NextResponse.json(
        {
          error: userError?.message || profileError?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      auth: {
        id: authUser.id,
        email: authUser.email,
      },
      users: userRow,
      profiles: profileRow,
      isAdmin: userRow?.role === 'admin',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
