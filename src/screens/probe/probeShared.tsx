import { useEffect, useState, type ReactNode } from 'react';
import { engine } from '../../audio/engine';
import { getProbeClip, type ClipId } from '../../audio/probeAudio';
import { useEngineState } from '../../audio/useEngine';
import { Icon } from '../../components/ui/Icon';
import { tx } from '../../i18n';
import type { CueId, EmphId, ProbeItem } from '../../types';
import './probe.css';

export type ProbeStage = 'intro' | 'practice' | 'items' | 'reflect' | 'done';

/** 문항별 무작위값(새로고침해도 유지) */
export interface ItemRand {
  origIsA: boolean; // 유형 A
  sliderStart: number; // 유형 A
  flip: boolean; // 유형 B: true면 화면의 A가 pair[1]
}

export interface ProbeSession {
  set: 1 | 2;
  items: ProbeItem[];
  rand: Record<string, ItemRand>;
  practiceRand: ItemRand;
  index: number;
  stage: ProbeStage;
}

export function makeRand(): ItemRand {
  return { origIsA: Math.random() < 0.5, sliderStart: Math.round(10 + Math.random() * 80), flip: Math.random() < 0.5 };
}

const skey = (set: number) => `cihall.probeSession.set${set}`;

export function loadSession(set: 1 | 2): ProbeSession | null {
  try {
    const raw = sessionStorage.getItem(skey(set));
    if (!raw) return null;
    const s = JSON.parse(raw) as ProbeSession;
    return s && s.set === set && Array.isArray(s.items) ? s : null;
  } catch {
    return null;
  }
}
export function saveSession(s: ProbeSession) {
  try {
    sessionStorage.setItem(skey(s.set), JSON.stringify(s));
  } catch {
    /* 저장 안 돼도 계속 */
  }
}
export function clearSession(set: 1 | 2) {
  try {
    sessionStorage.removeItem(skey(set));
  } catch {
    /* 무시 */
  }
}

/** 클립을 미리 만들어 둔다 */
export function useProbeClips(ids: ClipId[]) {
  const key = ids.join('|');
  const [bufs, setBufs] = useState<Partial<Record<ClipId, AudioBuffer>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setBufs(null);
    setError(false);
    const ctx = engine.ctx;
    if (!ctx) {
      setError(true);
      return;
    }
    Promise.all(ids.map((id) => getProbeClip(ctx, id)))
      .then((arr) => {
        if (!alive) return;
        const o: Partial<Record<ClipId, AudioBuffer>> = {};
        ids.forEach((id, i) => (o[id] = arr[i]));
        setBufs(o);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => engine.stopClip(), []);
  return { bufs, error };
}

export function ListenButton({
  label,
  clipId,
  disabled,
  onPress,
}: {
  label: string;
  clipId: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const st = useEngineState();
  const playing = st.clip === clipId;
  return (
    <button type="button" className={`btn probe-listen${playing ? ' is-selected' : ''}`} disabled={disabled} onClick={onPress}>
      <span className="row" style={{ gap: 6, justifyContent: 'center' }}>
        <Icon name={playing ? 'speaker' : 'play'} />
        {label}
      </span>
      {playing && <span className="small" role="status">{tx('소리 나는 중', 'Playing')}</span>}
    </button>
  );
}

export function ProgressBar({ index, total, title }: { index: number; total: number; title?: string }) {
  return (
    <div className="probe-progress">
      <h1 style={{ margin: 0, fontSize: 24 }}>{title ?? tx(`잠깐 질문 (${index + 1}/${total})`, `Quick questions (${index + 1}/${total})`)}</h1>
      <div className="probe-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1} aria-label={tx('진행', 'Progress')}>
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** 선택 버튼 줄(테두리 + 체크, 강조 색 없음) */
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: ReactNode;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label={typeof label === 'string' ? label : undefined}>
      <p className="probe-q">{label}</p>
      <div className="probe-choices">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`btn${value === o.value ? ' is-selected' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            <span className="row" style={{ gap: 6, justifyContent: 'center' }}>
              {value === o.value && <Icon name="check" size={18} />}
              {o.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { CueId, EmphId };
