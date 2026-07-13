import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthenticatedUser, requireAdmin } from '@/lib/server-auth';

export async function requireAuthenticatedRequest(request: Request): Promise<User | NextResponse> {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return user;
}

export async function requireAdminRequest(request: Request): Promise<User | NextResponse> {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  return user;
}

export function isAuthResponse(value: User | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
