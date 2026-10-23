import { useEffect, useRef } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { Icon } from '../ui/Icon';
import { INSTRUMENT_LABEL, type InstrumentId, type MotionLevel, type RoomMode } from '../../types';
import { InstrumentFigure, type FigurePose } from './figures';
import './instruments.css';

export { InstrumentFigure };

export interface InstrumentCardProps {
  id: InstrumentId;
  on: boolean;
  selected: boolean;
  mode: RoomMode;
  motion: MotionLevel;
  animate?: boolean;
  blindNumber?: 1 | 2 | 3;
  revealed?: boolean;
  compact?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
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

  const name = hidden ? `악기 ${blindNumber}` : INSTRUMENT_LABEL[id];
  const onTxt = on ? '켜짐' : '꺼짐';
  const hint =
    mode === 'toggle'
      ? on ? '누르면 끄기' : '누르면 켜기'
      : selected ? '누르면 모두 함께 들어요' : `누르면 ${hidden ? name : INSTRUMENT_LABEL[id]}만 들어요`;
  const label = `${name}, ${onTxt}${selected ? ', 혼자 듣는 중' : ''}, ${hint}`;

  return (
    <button
      ref={cardRef}
      type="button"
      className={'inst-card' + (selected ? ' is-selected' : '') + (compact ? ' is-compact' : '') + (on ? ' is-on' : ' is-off')}
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
        {selected && <span className="inst-tag">혼자 듣는 중</span>}
        {blindNumber !== undefined && revealed && <span className="inst-tag is-soft">악기 {blindNumber}</span>}
      </span>
    </button>
  );
}
