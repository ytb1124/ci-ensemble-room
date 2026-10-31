// 관리자 로그인과 문구 저장. 표와 권한은 supabase/schema.sql(admins, text_overrides).
// 참여자 익명 세션(research.ts)과 섞이지 않도록 로그인 정보를 다른 이름으로 저장하는 별도 클라이언트를 쓴다.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { overridesStore } from '../../store/textOverrides';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: { storageKey: 'cihall.admin.auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

export const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);

export async function getSession(): Promise<Session | null> {
  const { data } = await sb().auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error('로그인하지 못했어요');
  return data.session;
}

export async function signOut() {
  await sb().auth.signOut();
}

/** admins 표에 내 id가 있는지. 다른 사람 행은 RLS로 보이지 않는다 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await sb().from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

/** 서버의 최신 수정 문구를 받아 이 기기 값도 바꾼다 */
export async function fetchOverrides(): Promise<void> {
  const { data, error } = await sb().from('text_overrides').select('key,value');
  if (error) throw error;
  overridesStore.set(Object.fromEntries((data as { key: string; value: string }[]).map((r) => [r.key, r.value])));
}

export async function saveOverride(key: string, value: string): Promise<void> {
  const { error } = await sb().from('text_overrides').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  overridesStore.set((o) => ({ ...o, [key]: value }));
}

/** 원래 문구로 되돌린다(수정 기록을 지운다) */
export async function deleteOverride(key: string): Promise<void> {
  const { error } = await sb().from('text_overrides').delete().eq('key', key);
  if (error) throw error;
  overridesStore.set((o) => {
    const { [key]: _drop, ...rest } = o;
    void _drop;
    return rest;
  });
}
