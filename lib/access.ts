import { supabase } from '@/lib/supabase';
import type { ExamTrack, UserExamAccess } from '@/types/database';

export interface ActiveTrackAccess extends UserExamAccess {
  exam_track: ExamTrack;
}

export async function getActiveTrackAccess(userId: string) {
  const { data, error } = await supabase
    .from('user_exam_access')
    .select('*, exam_track:exam_tracks(*)')
    .eq('user_id', userId)
    .eq('active', true)
    .order('granted_at', { ascending: false });

  return {
    data: (data || []) as ActiveTrackAccess[],
    error,
  };
}

export async function hasActiveTrackAccess(userId: string, examTrackId: string) {
  const { data } = await supabase
    .from('user_exam_access')
    .select('id')
    .eq('user_id', userId)
    .eq('exam_track_id', examTrackId)
    .eq('active', true)
    .limit(1);

  return Boolean(data?.length);
}
