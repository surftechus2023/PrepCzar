import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client is not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth client is not configured.');
  }

  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireAdmin(request: Request): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return data?.role === 'admin' ? user : null;
}

export async function userHasTrackAccess(userId: string, examTrackId: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('user_exam_access')
    .select('id')
    .eq('user_id', userId)
    .eq('exam_track_id', examTrackId)
    .eq('active', true)
    .limit(1);

  return Boolean(data?.length);
}
