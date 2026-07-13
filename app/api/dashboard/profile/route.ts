import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, getSupabaseAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const updateProfileSchema = z.object({
  full_name: z.string().max(160).optional(),
  preferred_language: z.enum(['en', 'es', 'fr']).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = updateProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile update', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const updateValues = parsed.data;

    const { error: usersError } = await supabaseAdmin
      .from('users')
      .update(updateValues)
      .eq('id', authUser.id);

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: authUser.email || '',
        ...(parsed.data.full_name !== undefined ? { full_name: parsed.data.full_name } : {}),
        ...(parsed.data.preferred_language !== undefined ? { preferred_language: parsed.data.preferred_language } : {}),
      }, { onConflict: 'id' });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
