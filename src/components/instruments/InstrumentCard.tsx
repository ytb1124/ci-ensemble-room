import { useEffect, useRef } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { Icon } from '../ui/Icon';
import { INSTRUMENT_LABEL, type InstrumentId, type MotionLevel, type RoomMode } from '../../types';
import { InstrumentFigure, type FigurePose } from './figures';
import { getLang, tx } from '../../i18n';
import './instruments.css';

export { InstrumentFigure };

export interface InstrumentCardProps {
  id: InstrumentId;
  on: boolean;
  selected: boolean;
  mode: RoomMode;
  motion: MotionLevel;
  animate?: boolean;
  blindNumber?: number;
  revealed?: boolean;
  compact?: boolean;
  /** 있으면 카드 아래에 크기 조절 줄을 붙인다(누르는 영역과 분리) */
  volume?: VolumeProps;
  onPress: () => void;
  onLongPress?: () => void;
}

export interface VolumeProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

/** dB 대신 말로 보여 준다 */
export function volumeWord(db: number): string {
  if (db === 0) return tx('보통', 'Normal');
  if (db > 0) return db <= 2 ? tx('조금 크게', 'A bit louder') : db <= 6 ? tx('크게', 'Louder') : tx('아주 크게', 'Much louder');
  return db >= -4 ? tx('조금 작게', 'A bit softer') : db >= -8 ? tx('작게', 'Softer') : tx('아주 작게', 'Much softer');
}

function VolumeStrip({ name, v }: { name: string; v: VolumeProps }) {
  const pct = ((v.value - v.min) / (v.max - v.min)) * 100;
  const zero = ((0 - v.min) / (v.max - v.min)) * 100;
  const set = (n: number) => v.onChange(Math.max(v.min, Math.min(v.max, n)));
  return (
    <div className="inst-vol" role="group" aria-label={tx(`${name} 크기`, `${name} volume`)}>
      <button type="button" className="inst-vol-btn" aria-label={tx(`${name} 작게`, `${name} softer`)} disabled={v.value <= v.min} onClick={() => set(v.value - v.step)}>
        <Icon name="minus" size={20} />
      </button>
      <div className="inst-vol-mid">
        <span className="inst-vol-word" aria-live="polite">{volumeWord(v.value)}</span>
        <span className="inst-vol-meter" aria-hidden="true">
          <span className="inst-vol-zero" style={{ left: `${zero}%` }} />
          <span className="inst-vol-fill" style={{ width: `${pct}%` }} />
        </span>
      </div>
      <button type="button" className="inst-vol-btn" aria-label={tx(`${name} 크게`, `${name} louder`)} disabled={v.value >= v.max} onClick={() => set(v.value + v.step)}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

const COEF: Record<MotionLevel, number> = { off: 0, calm: 0.35, normal: 0.7, vivid: 1 };

/** t 이하의 마지막 온셋 (이진 탐색) */
function lastOnset<T extends { t: number }>(arr: T[], t: number): T | null {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? arr[ans] : null;
}

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function InstrumentCard(p: InstrumentCardProps) {
  const { id, on, selected, mode, motion, animate = true, blindNumber, revealed = false, compact = false } = p;
  const cardRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const last = useRef({ pose: 'idle' as FigurePose, fi: 0, pulse: 0 });
  const lastLoud = useRef(-Infinity);

  const hidden = blindNumber !== undefined && !revealed;
  const coef = Math.min(COEF[motion], reducedMotion() ? 0.35 : 1);
  const live = animate && coef > 0 && on && !hidden;

  const apply = (pose: FigurePose, fi: number, pulse: number, level: number) => {
    const el = cardRef.current;
    if (!el) return;
    const l = last.current;
    const q = Math.round(fi * 20) / 20;
    const svg = el.querySelector('svg.inst-fig') as SVGSVGElement | null;
    if (svg) {
      if (l.pose !== pose) svg.setAttribute('data-pose', pose);
      if (l.fi !== q) svg.style.setProperty('--fi', String(q));
      if (l.pulse !== pulse) svg.style.setProperty('--pulse', String(pulse));
    }
    el.style.setProperty('--inst-level', level.toFixed(2));
    l.pose = pose;
    l.fi = q;
    l.pulse = pulse;
  };

  useAnimationFrame(() => {
    const now = engine.songTime();
    const playing = engine.store.get().playing;
    const lv = playing ? engine.level(id) : 0;
    let pose: FigurePose = 'idle';
    let pulse = 0;
    if (playing && lv > 0) {
      if (id === 'cajon') {
        const o = lastOnset(engine.timeline('cajon')?.onsets ?? [], now);
        if (o && now - o.t <= 0.12) pose = o.kind === 'bassTone' ? 'hitCenter' : o.kind === 'slap' ? 'hitEdge' : 'idle';
      } else if (id === 'piano') {
        const o = lastOnset(engine.timeline('piano')?.onsets ?? [], now);
        if (o && now - o.t <= 0.14) pose = 'press';
      } else if (id === 'bass') {
        const o = lastOnset(engine.timeline('bass')?.onsets ?? [], now);
        if (o && now - o.t <= 0.15) pose = 'pluck';
      }
    }
    if (id === 'trumpet' && playing) {
      if (lastLoud.current > now) lastLoud.current = -Infinity; // 되감기
      if (lv > 0.05) {
        lastLoud.current = now;
        pose = 'blow';
        const o = lastOnset(engine.timeline('trumpet')?.onsets ?? [], now);
        if (o && now - o.t <= 0.08) pulse = 1;
      } else if (now - lastLoud.current > 0.4) pose = 'rest';
    }
    let fi = Math.min(1, lv * 1.5) * coef;
    if (pose !== 'idle') fi = Math.max(fi, 0.3 * coef);
    apply(pose, fi, pulse, lv);
  }, live);

  // 정지 상태(켬/끔만 표시)로 되돌리기
  useEffect(() => {
    if (!live) apply('idle', 0, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const down = () => {
    fired.current = false;
    if (!p.onLongPress) return;
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      fired.current = true;
      p.onLongPress?.();
    }, 500);
  };
  const click = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    p.onPress();
  };

  const name = hidden ? tx(`악기 ${blindNumber}`, `Instrument ${blindNumber}`) : INSTRUMENT_LABEL[id];
  const onTxt = on ? tx('켜짐', 'On') : tx('꺼짐', 'Off');
  const hint =
    mode === 'toggle'
      ? on ? tx('누르면 끄기', 'Tap to turn off') : tx('누르면 켜기', 'Tap to turn on')
      : selected
        ? tx('누르면 모두 함께 들어요', 'Tap to hear all together')
        : getLang() === 'en'
          ? `Tap to hear only ${hidden ? name : INSTRUMENT_LABEL[id]}`
          : `누르면 ${hidden ? name : INSTRUMENT_LABEL[id]}만 들어요`;
  const label = `${name}, ${onTxt}${selected ? tx(', 혼자 듣는 중', ', Solo') : ''}, ${hint}`;

  const card = (
    <button
      ref={cardRef}
      type="button"
      className={'inst-card' + (selected && !p.volume ? ' is-selected' : '') + (compact ? ' is-compact' : '') + (p.volume ? ' is-boxed' : '') + (on ? ' is-on' : ' is-off')}
      aria-label={label}
      aria-pressed={mode === 'toggle' ? on : selected}
      onClick={click}
      onPointerDown={down}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={p.onLongPress ? (e) => e.preventDefault() : undefined}
    >
      <span className="inst-art" aria-hidden="true">
        {hidden ? (
          <span className={'inst-blind-num' + (on ? '' : ' is-off')}>{blindNumber}</span>
        ) : (
          <InstrumentFigure id={id} on={on} />
        )}
      </span>
      <span className="inst-name" aria-hidden="true">{name}</span>
      <span className={'inst-state' + (on ? '' : ' is-off')} aria-hidden="true">
        <Icon name={on ? 'on' : 'off'} size={18} />
        {onTxt}
      </span>
      <span className="inst-tags" aria-hidden="true">
        {selected && <span className="inst-tag">{tx('혼자 듣는 중', 'Solo')}</span>}
        {blindNumber !== undefined && revealed && <span className="inst-tag is-soft">{tx(`악기 ${blindNumber}`, `Instrument ${blindNumber}`)}</span>}
      </span>
    </button>
  );
  if (!p.volume) return card;
  return (
    <div className={'inst-cardbox' + (selected ? ' is-selected' : '')}>
      {card}
      <VolumeStrip name={name} v={p.volume} />
    </div>
  );
}
