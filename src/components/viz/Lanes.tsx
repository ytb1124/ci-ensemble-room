// 레인 보기(구성안 7.1). 시간은 오른쪽→왼쪽, 재생선 고정. 모든 시각은 engine.songTime() 하나만 쓴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useAnimationFrame, useEngineState } from '../../audio/useEngine';
import { effectiveInstGain, profileStore } from '../../store/profile';
import type { InstrumentId, MotionLevel } from '../../types';
import { INSTRUMENTS, INSTRUMENT_SHORT } from '../../types';
import { tx } from '../../i18n';
import './viz.css';

export interface VizColors {
  lane: Record<InstrumentId, string>;
  soft: string;
  ink: string;
  body: string;
  muted: string;
  hair: string;
  primary: string;
}

export function readColors(el: Element): VizColors {
  const cs = getComputedStyle(el);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    lane: { piano: v('--lane-piano', '#7e22ce'), cajon: v('--lane-cajon', '#c2410c'), bass: v('--lane-bass', '#1e3a8a'), trumpet: v('--lane-trumpet', '#a16207') },
    soft: v('--surface-soft', '#faf5e8'),
    ink: v('--ink', '#0a0a0a'),
    body: v('--body-strong', '#1a1a1a'),
    muted: v('--muted', '#5f5f5f'),
    hair: v('--hairline-strong', '#999'),
    primary: v('--primary', '#0a0a0a'),
  };
}

/** 폭에 맞는 캔버스(ResizeObserver, devicePixelRatio). 높이는 폭에 따라 정한다 */
export function useFitCanvas(heightFor: (w: number) => number) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 300, h: 180, dpr: 1 });
  const hf = useRef(heightFor);
  hf.current = heightFor;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const fit = () => {
      const w = Math.max(100, Math.floor(c.getBoundingClientRect().width));
      const h = hf.current(w);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { w, h, dpr };
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.height = `${h}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

const AHEAD = 4;
const MOTION_K: Record<MotionLevel, number> = { off: 0, calm: 0.35, normal: 0.7, vivid: 1.1 };
const LABEL_W_WIDE = 92;
const LABEL_W_NARROW = 82;

function glyph(g: CanvasRenderingContext2D, id: InstrumentId, x: number, y: number, s: number) {
  g.beginPath();
  if (id === 'cajon') g.rect(x - s, y - s, s * 2, s * 2); // 네모
  else if (id === 'bass') g.ellipse(x, y, s * 0.7, s * 1.1, 0, 0, Math.PI * 2); // 세로 타원
  else if (id === 'piano') {
    g.moveTo(x, y - s); // 마름모
    g.lineTo(x + s, y);
    g.lineTo(x, y + s);
    g.lineTo(x - s, y);
    g.closePath();
  }
  else {
    g.moveTo(x - s, y + s * 0.8); // 삼각형
    g.lineTo(x + s, y);
    g.lineTo(x - s, y - s * 0.8);
    g.closePath();
  }
}

export function Lanes(p: { on: Record<InstrumentId, boolean>; pitchLines: boolean; bassEmphasis: boolean; motion: MotionLevel }) {
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 220 : 260));
  const colors = useRef<VizColors | null>(null);
  const frameNo = useRef(0);
  const st = useEngineState();
  const [hasPitch, setHasPitch] = useState(false);
  const props = useRef(p);
  props.current = p;

  useEffect(() => {
    const check = () => setHasPitch(INSTRUMENTS.some((i) => i !== 'cajon' && !!engine.timeline(i)?.pitch));
    check();
  }, [st.songId, st.loading]);

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    if (!colors.current || frameNo.current++ % 45 === 0) colors.current = readColors(c);
    const col = colors.current;
    const { w, h, dpr } = size.current;
    const { on, pitchLines, bassEmphasis, motion } = props.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col.soft;
    g.fillRect(0, 0, w, h);

    const labelW = w < 420 ? LABEL_W_NARROW : LABEL_W_WIDE;
    const px = Math.max(labelW + 24, w * 0.3);
    const pps = (w - px - 8) / AHEAD;
    const behind = (px - labelW) / pps;
    const t = engine.songTime();
    const prof = profileStore.get();
    const inst = effectiveInstGain(prof, st.songId);
    const k = MOTION_K[motion];
    const order: InstrumentId[] = ['trumpet', 'piano', 'bass', 'cajon'];
    const laneH = (h - 8) / order.length;
    const showBars = pitchLines;

    order.forEach((id, idx) => {
      const y0 = 4 + idx * laneH;
      const cy = y0 + laneH / 2;
      const isOn = on[id];
      const tl = engine.timeline(id);
      const base = isOn ? col.lane[id] : col.muted;
      const heavy = id === 'bass' && bassEmphasis;
      // 레인 바탕과 중심선
      g.fillStyle = isOn ? withAlpha(base, heavy ? 0.22 : 0.1) : withAlpha(col.muted, 0.08);
      g.fillRect(labelW, y0 + 2, w - labelW, laneH - 4);
      if (heavy) {
        g.strokeStyle = base;
        g.lineWidth = 2;
        g.strokeRect(labelW + 1, y0 + 3, w - labelW - 2, laneH - 6);
      }
      // 이름 + 아이콘
      g.fillStyle = base;
      glyph(g, id, 14, cy, 7);
      if (isOn) g.fill();
      else {
        g.lineWidth = 2;
        g.strokeStyle = col.muted;
        g.stroke();
      }
      g.font = `700 ${w < 420 ? 14 : 15}px system-ui, -apple-system, 'Noto Sans KR', sans-serif`;
      g.textBaseline = 'middle';
      g.fillStyle = isOn ? col.body : col.muted;
      g.fillText(INSTRUMENT_SHORT[id], 28, cy - (isOn ? 0 : 8));
      if (!isOn) {
        g.font = `600 14px system-ui, -apple-system, 'Noto Sans KR', sans-serif`;
        g.fillText(tx('꺼짐', 'Off'), 28, cy + 10);
      }
      if (!tl) return;

      // 피치 라인 또는 음 길이 막대
      if (id !== 'cajon' && showBars) {
        const pitch = tl.pitch;
        if (pitch) {
          g.beginPath();
          let pen = false;
          const step = 3;
          for (let x = labelW; x <= w; x += step) {
            const tt = t + (x - px) / pps;
            const i = Math.floor(tt / tl.hop);
            const v = i >= 0 && i < pitch.length ? pitch[i] : 0;
            if (v <= 0) {
              pen = false;
              continue;
            }
            const y = y0 + laneH - 6 - v * (laneH - 12);
            if (!pen) {
              g.moveTo(x, y);
              pen = true;
            } else g.lineTo(x, y);
          }
          g.strokeStyle = base;
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.lineWidth = (id === 'trumpet' ? 4 : 2.5) * (heavy ? 1.6 : 1);
          g.globalAlpha = isOn ? 1 : 0.6;
          g.stroke();
          g.globalAlpha = 1;
        } else {
          for (const o of tl.onsets) {
            if (!o.dur) continue;
            const x1 = px + (o.t - t) * pps;
            const x2 = px + (o.t + o.dur - t) * pps;
            if (x2 < labelW || x1 > w) continue;
            const a = Math.max(labelW, x1);
            const b = Math.min(w, x2);
            if (b <= a) continue;
            const bh = id === 'trumpet' ? 8 : heavy ? 12 : 6;
            g.fillStyle = isOn ? withAlpha(base, 0.55) : withAlpha(col.muted, 0.35);
            g.fillRect(a, cy - bh / 2, b - a, bh);
          }
        }
      }

      // 온셋 원
      const vol = Math.min(1.3, Math.pow(10, (inst[id] ?? 0) / 20));
      const maxR = laneH / 2 - 2;
      for (const o of tl.onsets) {
        const dt = o.t - t; // + = 앞으로 올 것
        if (dt > AHEAD + 0.2 || dt < -(behind + 0.2)) continue;
        const x = px + dt * pps;
        if (x < labelW - 4) continue;
        const power = Math.min(1, o.strength * (isOn ? vol : 0.6));
        let r = w < 520 ? 3 + power * 6 : 4 + power * 8; // 번잡하지 않게(Fourney 지침)
        if (isOn && k > 0 && dt <= 0 && dt > -0.4) r *= 1 + k * Math.exp(-(-dt) / 0.12); // 지나가는 순간 커졌다 줄어듦
        r = Math.min(r, maxR);
        let y = cy;
        if (id === 'cajon') y = o.kind === 'slap' ? y0 + laneH * 0.3 : y0 + laneH * 0.72;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        if (isOn) {
          g.globalAlpha = 0.35 + 0.65 * power;
          g.fillStyle = base;
          g.fill();
          g.globalAlpha = 1;
          g.lineWidth = 1.5;
          g.strokeStyle = col.ink;
          g.globalAlpha = 0.5;
          g.stroke();
          g.globalAlpha = 1;
        } else {
          g.lineWidth = 2;
          g.strokeStyle = col.muted;
          g.stroke();
        }
      }
    });

    // 재생선
    g.strokeStyle = col.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px, 2);
    g.lineTo(px, h - 2);
    g.stroke();
  }, [ref, size, st.songId]);

  useAnimationFrame(draw, true);

  const nullPitch = INSTRUMENTS.every((i) => i === 'cajon' || !engine.timeline(i)?.pitch);
  return (
    <div className="viz-wrap">
      <div className="viz-canvas-box">
        <canvas
          ref={ref}
          className="viz-canvas"
          role="img"
          aria-label={tx('악기별 줄: 위에서부터 트럼펫, 피아노, 베이스, 카혼. 동그라미는 소리가 나는 순간', 'One row per instrument: from the top, trumpet, piano, bass, cajon. Circles show when a sound plays')}
        />
      </div>
      <div className="viz-legend">
        <span>{tx("카혼 줄: 아래는 가운데를 치는 '쿵', 위는 가장자리를 치는 '탁'", 'Cajon row: bottom is the deep "boom" from the center, top is the sharp "tak" from the edge')}</span>
        <span>{tx('세로선은 지금 들리는 순간, 그 오른쪽은 곧 나올 소리', 'The vertical line is what you hear now. To its right are sounds coming next')}</span>
      </div>
      {p.pitchLines && (nullPitch || !hasPitch) && <p className="viz-note">{tx('음높이 선은 실제 악기 녹음이 들어오면 보여요', 'Pitch lines will show once real instrument recordings are added')}</p>}
    </div>
  );
}

export function withAlpha(color: string, a: number): string {
  // #rrggbb → rgba. 그 밖의 형식은 globalAlpha 없이 그대로 쓴다
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
