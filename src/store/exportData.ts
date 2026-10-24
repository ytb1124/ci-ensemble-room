// 내보내기(JSON/CSV), 전체 삭제, 리포트 스냅샷 저장(구성안 9절).
// 이름·연락처는 받지 않는다. 내보내기는 사용자가 직접 누를 때만 일어난다.

import { engine } from '../audio/engine';
import { PROBE_MANIFEST } from '../audio/probeAudio';
import { clearLog, logStore, summarizeLog } from './log';
import { clearProbe, probeStore } from './probe';
import type { ProbeState } from './probe';
import { profileStore, resetProfile } from './profile';
import { describeChange } from './reportRules';
import { inLang } from '../i18n';
import { KEYS, readJSON, removeKey, writeJSON } from './storage';
import type { ProbeResponse } from '../types';

export const APP_VERSION = '0.1.0-prototype';
const MAX_EXPORT_EVENTS = 1000;

// ───────── 스냅샷(cihall.report.v1) ─────────
export interface ReportSnapshot {
  at: string;
  /** 사용된 응답 수 */
  responseCount: number;
  /** 사용된 세트 */
  sets: (1 | 2)[];
}

export function readSnapshots(): ReportSnapshot[] {
  const v = readJSON<ReportSnapshot[]>(KEYS.report, []);
  return Array.isArray(v) ? v : [];
}

/** 화면에 들어올 때마다 부른다. 마지막 스냅샷과 응답 수가 다를 때만 추가 */
export function recordSnapshot(state: ProbeState) {
  const n = state.responses.length;
  if (n === 0) return;
  const list = readSnapshots();
  if (list.length && list[list.length - 1].responseCount === n) return;
  const sets = ([1, 2] as const).filter((s) => state.responses.some((r) => r.set === s));
  writeJSON(KEYS.report, [...list, { at: new Date().toISOString(), responseCount: n, sets }].slice(-50));
}

// ───────── 내보내기 ─────────
function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(name: string, data: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function buildExport() {
  const events = logStore.get();
  return {
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profileStore.get(),
    logSummary: summarizeLog(events),
    events: events.slice(-MAX_EXPORT_EVENTS),
    probe: {
      responses: probeStore.get().responses,
      reflections: probeStore.get().reflections,
      completedSets: probeStore.get().completedSets,
    },
    reportSnapshots: readSnapshots(),
    probeManifest: inLang('ko', () => JSON.parse(JSON.stringify(PROBE_MANIFEST))), // getter를 한국어로 고정해 펼친다
    device: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...engine.latencyInfo(),
    },
  };
}

export function downloadJSON() {
  download(`cihall-export-${stamp()}.json`, JSON.stringify(buildExport(), null, 2), 'application/json');
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEAD = [
  'set', 'itemId', 'kind', 'cue_or_pair', 'isRepeat', 'origIsA', 'sliderStart', 'rating', 'chips', 'otherText', 'note',
  'a', 'b', 'clearer', 'confidence', 'preferSame', 'listensA', 'listensB', 'at', 'changed',
];

export function buildCSV(responses: ProbeResponse[]): string {
  const rows = responses.map((r) => {
    const changed = inLang('ko', () => describeChange(r).text); // 연구 데이터는 화면 언어와 상관없이 한국어로
    if (r.kind === 'A') {
      return [r.set, r.itemId, 'A', r.cue, r.isRepeat, r.origIsA, r.sliderStart, r.rating, r.chips.join('|'), r.otherText, r.note,
        '', '', '', '', '', r.listensA, r.listensB, r.at, changed];
    }
    return [r.set, r.itemId, 'B', `${r.a}/${r.b}`, '', '', '', '', '', '', '',
      r.a, r.b, r.clearer, r.confidence, r.preferSame, r.listensA, r.listensB, r.at, changed];
  });
  // UTF-8 BOM: 엑셀에서 한글이 깨지지 않게
  return '﻿' + [CSV_HEAD, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCSV() {
  download(`cihall-probe-${stamp()}.csv`, buildCSV(probeStore.get().responses), 'text/csv;charset=utf-8');
}

// ───────── 전체 삭제 ─────────
export function deleteAllData() {
  const hadSteady = profileStore.get().placeholderShape !== 'rhythm';
  resetProfile();
  clearLog();
  clearProbe();
  (Object.values(KEYS) as string[]).forEach(removeKey);
  if (hadSteady) void engine.reloadSong();
}
