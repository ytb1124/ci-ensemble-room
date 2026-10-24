// 연구 참여: 익명 로그인 + 동의 + 배경 설문 + 기기 기록을 서버(Supabase)로 보내기.
// 이름·연락처·이메일은 받지 않는다. 동의하지 않으면 아무것도 보내지 않는다.
// 서버 주소·키(.env.local)가 없으면 이 기능은 통째로 꺼진다(앱은 그대로 동작).
// 테이블 구조는 supabase/schema.sql.

import { useSyncExternalStore } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { APP_VERSION } from './exportData';
import { logStore } from './log';
import { probeStore } from './probe';
import { profileStore } from './profile';
import { createStore, readJSON, writeJSON } from './storage';
import { tx } from '../i18n';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const researchEnabled = !!(URL && KEY);

/** 동의 문구를 바꾸면 올린다. 서버에 어떤 문구로 동의했는지 남는다 */
export const CONSENT_VERSION = '2026-10-v1';

/** 보관 기간 안내. 연구팀(IRB) 결정에 맞춰 고친다 */
export const retentionText = () => tx('연구가 끝나면 지워요.', 'They are deleted when the study ends.');

// 연구 참여 상태는 '이 기기의 모든 데이터 지우기'와 따로 둔다(서버 데이터는 설정 > 연구 참여에서 지운다)
const STORE_KEY = 'cihall.research.v1';
const SYNC_DEBOUNCE_MS = 15_000;
const EVENT_CHUNK = 500;

export interface Survey {
  ageGroup?: string;
  wearing?: string;
  ciYears?: string;
  onset?: string;
  maker?: string;
  music?: string;
  route?: string;
}

export interface ResearchState {
  status: 'unknown' | 'joined' | 'declined' | 'withdrawn';
  joinedAt: string | null;
  survey: Survey;
  /** 여기까지 보낸 마지막 이벤트 시각(ms) */
  lastEventT: number;
  lastProfileAt: string | null;
  lastProbeKey: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
}

const INITIAL: ResearchState = {
  status: 'unknown',
  joinedAt: null,
  survey: {},
  lastEventT: 0,
  lastProfileAt: null,
  lastProbeKey: null,
  lastSyncAt: null,
  syncing: false,
  error: null,
};

export const researchStore = createStore<ResearchState>(
  { ...INITIAL, ...readJSON<Partial<ResearchState>>(STORE_KEY, {}), syncing: false },
  (v) => writeJSON(STORE_KEY, v),
);

export function useResearch(): ResearchState {
  return useSyncExternalStore(researchStore.subscribe, researchStore.get);
}

const patch = (p: Partial<ResearchState>) => researchStore.set((s) => ({ ...s, ...p }));

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** 익명 세션이 없으면 만든다. 참여자 id(= auth uid)를 돌려준다 */
async function ensureUser(): Promise<string> {
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb().auth.signInAnonymously();
  if (res.error || !res.data.user) throw res.error ?? new Error(tx('익명 로그인 실패', 'Anonymous sign-in failed'));
  return res.data.user.id;
}

/** 바뀌었는지만 보는 짧은 해시(FNV-1a) */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + ':' + s.length;
}

const errText =(e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

/** 동의하고 참여하기 */
export async function joinResearch(survey: Survey): Promise<boolean> {
  if (!researchEnabled) return false;
  try {
    const id = await ensureUser();
    const now = new Date().toISOString();
    const { error } = await sb().from('participants').upsert({
      id,
      consent_version: CONSENT_VERSION,
      consented_at: now,
      survey,
      app_version: APP_VERSION,
      user_agent: navigator.userAgent,
      updated_at: now,
    });
    if (error) throw error;
    // 참여 전 기록도 함께 보낸다(동의 화면에 적힌 대로)
    patch({ status: 'joined', joinedAt: now, survey, error: null, lastEventT: 0, lastProfileAt: null, lastProbeKey: null });
    void syncNow();
    return true;
  } catch (e) {
    patch({ error: errText(e) });
    return false;
  }
}

export async function updateSurvey(survey: Survey): Promise<boolean> {
  if (!researchEnabled || researchStore.get().status !== 'joined') return false;
  try {
    const id = await ensureUser();
    const { error } = await sb().from('participants').update({ survey, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    patch({ survey, error: null });
    return true;
  } catch (e) {
    patch({ error: errText(e) });
    return false;
  }
}

export function declineResearch() {
  patch({ status: 'declined' });
}

/** 참여 그만두기: 서버에 보낸 데이터를 모두 지우고 익명 세션을 끝낸다 */
export async function withdrawResearch(): Promise<boolean> {
  if (!researchEnabled) return false;
  try {
    const id = await ensureUser();
    // participant_state, events는 on delete cascade로 함께 지워진다
    const { error } = await sb().from('participants').delete().eq('id', id);
    if (error) throw error;
    await sb().auth.signOut();
    researchStore.set({ ...INITIAL, status: 'withdrawn' });
    return true;
  } catch (e) {
    patch({ error: errText(e) });
    return false;
  }
}

/** 바뀐 것만 보낸다. 실패하면 다음 기회에 다시 보낸다 */
export async function syncNow(): Promise<void> {
  const st = researchStore.get();
  if (!researchEnabled || st.status !== 'joined' || st.syncing) return;
  patch({ syncing: true });
  try {
    const id = await ensureUser();
    const now = new Date().toISOString();

    const profile = profileStore.get();
    if (profile.updatedAt !== st.lastProfileAt) {
      // audioUnlocked는 기기 상태라 빼고 보낸다
      const { audioUnlocked: _drop, ...payload } = profile;
      void _drop;
      const { error } = await sb().from('participant_state').upsert({ participant_id: id, kind: 'profile', payload, updated_at: now });
      if (error) throw error;
      patch({ lastProfileAt: profile.updatedAt });
    }

    const probe = probeStore.get();
    const probeKey = hash(JSON.stringify(probe));
    if (probeKey !== st.lastProbeKey && (probe.responses.length || probe.reflections.length)) {
      const { error } = await sb().from('participant_state').upsert({ participant_id: id, kind: 'probe', payload: probe, updated_at: now });
      if (error) throw error;
      patch({ lastProbeKey: probeKey });
    }

    const pending = logStore.get().filter((e) => e.t > st.lastEventT);
    for (let i = 0; i < pending.length; i += EVENT_CHUNK) {
      const chunk = pending.slice(i, i + EVENT_CHUNK);
      const rows = chunk.map((e) => ({
        participant_id: id,
        client_t: new Date(e.t).toISOString(),
        type: e.type,
        song: 'song' in e ? e.song : null,
        payload: e,
      }));
      const { error } = await sb().from('events').upsert(rows, { onConflict: 'participant_id,client_t,type', ignoreDuplicates: true });
      if (error) throw error;
      patch({ lastEventT: chunk[chunk.length - 1].t });
    }
    patch({ syncing: false, lastSyncAt: new Date().toISOString(), error: null });
  } catch (e) {
    patch({ syncing: false, error: errText(e) });
  }
}

let started = false;
/** 앱 시작 때 한 번. 기록이 바뀌면 잠시 뒤에, 화면을 떠날 때는 바로 보낸다 */
export function initResearch() {
  if (started || !researchEnabled) return;
  started = true;
  let timer: number | null = null;
  const schedule = () => {
    if (researchStore.get().status !== 'joined') return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void syncNow();
    }, SYNC_DEBOUNCE_MS);
  };
  logStore.subscribe(schedule);
  probeStore.subscribe(schedule);
  profileStore.subscribe(schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void syncNow();
  });
  void syncNow();
}
