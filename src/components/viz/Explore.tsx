// 탐색 보기(구성안 7.1, 7.5 (5)): 파형/엔벨로프, 스펙트럼 막대, 스펙트로그램.
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { effectiveInstGain, profileStore } from '../../store/profile';
import { rmsAt } from '../../audio/timeline';
import { Segmented } from '../ui/controls';
import type { InstrumentId } from '../../types';
import { INSTRUMENTS, INSTRUMENT_SHORT } from '../../types';
import { readColors, useFitCanvas, withAlpha, type VizColors } from './Lanes';
import { tx } from '../../i18n';
import './viz.css';

type View = 'wave' | 'spec' | 'sgram';
const HELP: Record<View, { title: string; text: string }> = {
  wave: { get title() { return tx('파형', 'Waveform'); }, get text() { return tx('악기마다 한 줄씩 보여요. 띠가 두꺼울수록 큰 소리예요. 세로선이 지금 들리는 순간이에요.', 'Each instrument has its own row. The thicker the band, the louder the sound. The vertical line is what you hear now.'); } },
  spec: { get title() { return tx('스펙트럼', 'Spectrum'); }, get text() { return tx('왼쪽은 낮은 소리, 오른쪽은 높은 소리예요. 산이 높을수록 그 높이의 소리가 커요. 악기마다 어디가 솟는지 비교해 보세요.', 'Low sounds are on the left, high sounds on the right. A taller peak means that pitch is louder. Compare where each instrument peaks.'); } },
  sgram: { get title() { return tx('스펙트로그램', 'Spectrogram'); }, get text() { return tx('위로 갈수록 높은 소리, 밝을수록 큰 소리예요. 시간이 지나면 오른쪽으로 쌓여요.', 'Higher up means a higher sound, and brighter means louder. Over time, it fills in toward the right.'); } },
};
const FONT = "system-ui, -apple-system, 'Noto Sans KR', sans-serif";

export function Explore(p: { on: Record<InstrumentId, boolean> }) {
  const [view, setView] = useState<View>('wave');
  return (
    <div className="viz-explore">
      <p className="viz-note">{tx('처음에는 낯설 수 있어요. 소리를 들으면서 여러 번 보면 익숙해져요.', 'This may feel unfamiliar at first. It gets easier if you watch it a few times while listening.')}</p>
      <Segmented
        label={tx('자세히 보기 종류', 'Detailed view type')}
        hideLabel
        value={view}
        onChange={setView}
        options={[
          { value: 'wave', label: tx('파형', 'Waveform') },
          { value: 'spec', label: tx('스펙트럼', 'Spectrum') },
          { value: 'sgram', label: tx('스펙트로그램', 'Spectrogram') },
        ]}
      />
      <div className="card card-soft viz-help" aria-live="polite">
        <h3>{HELP[view].title}</h3>
        <p>{HELP[view].text}</p>
      </div>
      {view === 'wave' && <WaveView on={p.on} />}
      {view === 'spec' && <SpectrumView on={p.on} />}
      {view === 'sgram' && <SgramView />}
      <Legend />
    </div>
  );
}

const DASH: Record<InstrumentId, number[]> = { piano: [6, 3, 1, 3], cajon: [], bass: [10, 5], trumpet: [2, 5] };
function Legend() {
  const [c, setC] = useState<VizColors | null>(null);
  useEffect(() => {
    setC(readColors(document.documentElement));
  }, []);
  return (
    <div className="viz-legend" aria-label={tx('악기 색과 선 모양', 'Instrument colors and line styles')}>
      {INSTRUMENTS.map((id) => (
        <span key={id} className="viz-legend-item">
          <span
            className="viz-swatch"
            style={{
              borderTopColor: c?.lane[id] ?? 'currentColor',
              borderTopStyle: id === 'cajon' ? 'solid' : id === 'bass' ? 'dashed' : 'dotted',
            }}
          />
          {INSTRUMENT_SHORT[id]}
        </span>
      ))}
    </div>
  );
}

// ───────── 공통: 악기별 줄 ─────────
/** 위에서부터 높은 악기 → 낮은 악기(레인 보기와 같은 순서) */
const ROW_ORDER: InstrumentId[] = ['trumpet', 'piano', 'bass', 'cajon'];
type Split = 'each' | 'all';

function rowLabel(g: CanvasRenderingContext2D, col: VizColors, id: InstrumentId, isOn: boolean, x: number, y: number) {
  const text = INSTRUMENT_SHORT[id] + (isOn ? '' : tx(' (꺼짐)', ' (off)'));
  g.font = `700 14px ${FONT}`;
  g.textBaseline = 'middle';
  const tw = g.measureText(text).width;
  // 글자 뒤 옅은 알약 바탕: 곡선 위에서도 읽히게
  g.fillStyle = withAlpha(col.soft, 0.85);
  pill(g, x, y - 12, tw + 30, 24, 12);
  g.fill();
  g.fillStyle = isOn ? col.lane[id] : col.muted;
  g.beginPath();
  g.arc(x + 12, y, 5, 0, Math.PI * 2);
  if (isOn) g.fill();
  else {
    g.lineWidth = 2;
    g.strokeStyle = col.muted;
    g.stroke();
  }
  g.fillStyle = isOn ? col.body : col.muted;
  g.fillText(text, x + 22, y + 1);
}

function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, rr);
  else g.rect(x, y, w, h);
}

function playhead(g: CanvasRenderingContext2D, col: VizColors, x: number, h: number) {
  g.strokeStyle = col.ink;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, 2);
  g.lineTo(x, h - 2);
  g.stroke();
  g.fillStyle = col.ink;
  g.beginPath();
  g.moveTo(x - 6, 0);
  g.lineTo(x + 6, 0);
  g.lineTo(x, 7);
  g.closePath();
  g.fill();
}

// ───────── ① 파형/엔벨로프 ─────────
function WaveView({ on }: { on: Record<InstrumentId, boolean> }) {
  const [split, setSplit] = useState<Split>('each');
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 240 : 300));
  const colors = useRef<VizColors | null>(null);
  const n = useRef(0);
  const onRef = useRef(on);
  onRef.current = on;
  const splitRef = useRef(split);
  splitRef.current = split;
  const draw = useCallback(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    if (!colors.current || n.current++ % 45 === 0) colors.current = readColors(c);
    const col = colors.current;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col.soft;
    g.fillRect(0, 0, w, h);
    const t = engine.songTime();
    const BACK = 2;
    const FWD = 4;
    const px = (w * BACK) / (BACK + FWD);
    const pps = w / (BACK + FWD);
    const inst = effectiveInstGain(profileStore.get(), engine.state.songId);
    const each = splitRef.current === 'each';
    const rowH = each ? h / ROW_ORDER.length : h;

    ROW_ORDER.forEach((id, k) => {
      const tl = engine.timeline(id);
      if (!tl) return;
      const isOn = onRef.current[id];
      const gain = isOn ? Math.pow(10, (inst[id] ?? 0) / 20) : 0.35;
      const color = isOn ? col.lane[id] : col.muted;
      const y0 = each ? k * rowH : 0;
      const mid = each ? y0 + rowH / 2 : h - 10;
      const amp = each ? rowH / 2 - 6 : h - 24;
      // 가운데를 기준으로 위아래가 같은 모양(악기별) 또는 바닥에서 솟는 모양(겹쳐 보기)
      const pts: number[] = [];
      for (let x = 0; x <= w; x += 2) {
        const v = Math.min(1, rmsAt(tl, t + (x - px) / pps) * gain);
        pts.push(Math.pow(v, 0.8) * amp);
      }
      g.beginPath();
      g.moveTo(0, mid);
      pts.forEach((v, i) => g.lineTo(i * 2, mid - v));
      if (each) for (let i = pts.length - 1; i >= 0; i--) g.lineTo(i * 2, mid + pts[i]);
      else g.lineTo(w, mid);
      g.closePath();
      const grad = g.createLinearGradient(0, mid - amp, 0, each ? mid + amp : mid);
      if (each) {
        grad.addColorStop(0, withAlpha(color, 0.25));
        grad.addColorStop(0.5, withAlpha(color, isOn ? 0.95 : 0.4));
        grad.addColorStop(1, withAlpha(color, 0.25));
      } else {
        grad.addColorStop(0, withAlpha(color, isOn ? 0.55 : 0.2));
        grad.addColorStop(1, withAlpha(color, 0.05));
      }
      g.fillStyle = grad;
      g.fill();
      if (!each) {
        g.beginPath();
        pts.forEach((v, i) => (i ? g.lineTo(i * 2, mid - v) : g.moveTo(0, mid - v)));
        g.setLineDash(DASH[id]);
        g.lineWidth = id === 'trumpet' ? 3 : 2.5;
        g.strokeStyle = color;
        g.stroke();
        g.setLineDash([]);
      } else {
        // 가운데 기준선과 줄 구분선
        g.strokeStyle = withAlpha(color, 0.35);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, mid + 0.5);
        g.lineTo(w, mid + 0.5);
        g.stroke();
        if (k > 0) {
          g.strokeStyle = col.hair;
          g.beginPath();
          g.moveTo(0, y0 + 0.5);
          g.lineTo(w, y0 + 0.5);
          g.stroke();
        }
      }
    });
    // 앞으로 올 부분은 살짝 흐리게
    g.fillStyle = withAlpha(col.soft, 0.45);
    g.fillRect(px, 0, w - px, h);
    if (each) ROW_ORDER.forEach((id, k) => rowLabel(g, col, id, onRef.current[id], 6, k * rowH + 16));
    playhead(g, col, px, h);
  }, [ref, size]);
  useAnimationFrame(draw, true);
  return (
    <div className="viz-wrap">
      <Segmented
        label={tx('보기 범위', 'Show')}
        value={split}
        onChange={setSplit}
        options={[
          { value: 'each', label: tx('악기별', 'By instrument') },
          { value: 'all', label: tx('겹쳐 보기', 'Overlaid') },
        ]}
      />
      <div className="viz-canvas-box">
        <canvas
          ref={ref}
          className="viz-canvas"
          role="img"
          aria-label={split === 'each'
            ? tx('악기마다 한 줄씩 그린 소리 크기 모양. 위에서부터 트럼펫, 피아노, 베이스, 카혼. 두꺼울수록 큰 소리', 'One row per instrument showing loudness: from the top, trumpet, piano, bass, cajon. Thicker means louder')
            : tx('악기별 소리 크기 곡선. 선이 높을수록 큰 소리', 'Loudness curve for each instrument. A higher line means a louder sound')}
        />
      </div>
    </div>
  );
}

// ───────── ② 스펙트럼 ─────────
const F0 = 50;
const F1 = 8000;
function useSmoothing(value: number) {
  useEffect(() => {
    const prev = INSTRUMENTS.map((i) => engine.analyser(i)?.smoothingTimeConstant ?? 0.6);
    INSTRUMENTS.forEach((i) => {
      const a = engine.analyser(i);
      if (a) a.smoothingTimeConstant = value;
    });
    return () => {
      INSTRUMENTS.forEach((i, k) => {
        const a = engine.analyser(i);
        if (a) a.smoothingTimeConstant = prev[k] > 0.3 ? prev[k] : 0.6;
      });
    };
  }, [value]);
}

function bandEdges(bins: number, sr: number, count: number) {
  const nyq = sr / 2;
  const out: [number, number][] = [];
  for (let b = 0; b < count; b++) {
    const lo = F0 * Math.pow(F1 / F0, b / count);
    const hi = F0 * Math.pow(F1 / F0, (b + 1) / count);
    const i0 = Math.max(1, Math.floor((lo / nyq) * bins));
    const i1 = Math.max(i0, Math.min(bins - 1, Math.floor((hi / nyq) * bins)));
    out.push([i0, i1]);
  }
  return out;
}

/** 전체 보기 막대 색: 아래 초록 → 노랑 → 위 산호(높을수록 큰 소리). 라이트·다크 모두에서 보이는 고정 색 */
const BAR_STOPS: [number, string][] = [[0, '#2f8a6c'], [0.55, '#e8b94a'], [1, '#ff6b5a']];
const GRID_HZ: [number, string][] = [[100, '100'], [500, '500'], [1000, '1k'], [4000, '4k']];

function SpectrumView({ on }: { on: Record<InstrumentId, boolean> }) {
  const [split, setSplit] = useState<Split>('each');
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 240 : 300));
  const colors = useRef<VizColors | null>(null);
  const n = useRef(0);
  const bufs = useRef<Record<string, Float32Array>>({});
  const peaks = useRef<number[]>([]);
  const splitRef = useRef(split);
  splitRef.current = split;
  const onRef = useRef(on);
  onRef.current = on;
  useSmoothing(0.7);

  const draw = useCallback((dtMs: number) => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g || !engine.ctx) return;
    if (!colors.current || n.current++ % 45 === 0) colors.current = readColors(c);
    const col = colors.current;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col.soft;
    g.fillRect(0, 0, w, h);
    const sr = engine.ctx.sampleRate;
    const data: Partial<Record<InstrumentId, Float32Array>> = {};
    let minDb = -100;
    let maxDb = -30;
    let bins = 0;
    for (const id of INSTRUMENTS) {
      const a = engine.analyser(id);
      if (!a) continue;
      bins = a.frequencyBinCount;
      minDb = a.minDecibels;
      maxDb = a.maxDecibels;
      let b = bufs.current[id];
      if (!b || b.length !== bins) b = bufs.current[id] = new Float32Array(bins);
      a.getFloatFrequencyData(b as Float32Array<ArrayBuffer>);
      data[id] = b;
    }
    if (!bins) return;
    const norm = (v: number) => (Math.max(v, minDb) - minDb) / (maxDb - minDb);
    const bandMax = (arr: Float32Array, [i0, i1]: [number, number]) => {
      let m = -Infinity;
      for (let i = i0; i <= i1; i++) if (arr[i] > m) m = arr[i];
      return m;
    };
    const xOfHz = (hz: number) => (Math.log(hz / F0) / Math.log(F1 / F0)) * w;

    // 세로 눈금(낮은 소리 ↔ 높은 소리)
    g.font = `600 14px ${FONT}`;
    g.textBaseline = 'bottom';
    for (const [hz, label] of GRID_HZ) {
      const x = Math.round(xOfHz(hz)) + 0.5;
      g.strokeStyle = withAlpha(col.hair, 0.6);
      g.lineWidth = 1;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = col.muted;
      g.fillText(label, x + 4, h - 2);
    }

    if (splitRef.current === 'all') {
      const count = w < 420 ? 28 : 44;
      const edges = bandEdges(bins, sr, count);
      const vals = edges.map((e) => {
        let pw = 0;
        for (const id of INSTRUMENTS) {
          const arr = data[id];
          if (arr) pw += Math.pow(10, Math.max(bandMax(arr, e), minDb) / 10);
        }
        return norm(10 * Math.log10(pw || 1e-12));
      });
      if (peaks.current.length !== count) peaks.current = new Array(count).fill(0);
      const fall = (Math.min(dtMs, 100) / 1000) * 0.5;
      const top = 10;
      const base = h - 22;
      const grad = g.createLinearGradient(0, base, 0, top);
      for (const [o, cc] of BAR_STOPS) grad.addColorStop(o, cc);
      const bw = w / count;
      const gap = Math.max(2, bw * 0.22);
      vals.forEach((v, i) => {
        const bh = Math.max(3, v * (base - top));
        const x = i * bw + gap / 2;
        g.fillStyle = grad;
        pill(g, x, base - bh, bw - gap, bh, (bw - gap) / 2);
        g.fill();
        const pk = (peaks.current[i] = Math.max(v, peaks.current[i] - fall));
        g.fillStyle = withAlpha(col.ink, 0.55);
        pill(g, x, base - pk * (base - top) - 5, bw - gap, 3, 1.5);
        g.fill();
      });
      return;
    }

    // 악기별: 한 줄에 한 악기, 매끈한 산 모양
    const count = w < 420 ? 40 : 64;
    const edges = bandEdges(bins, sr, count);
    const rowH = (h - 18) / ROW_ORDER.length;
    ROW_ORDER.forEach((id, k) => {
      const arr = data[id];
      const isOn = onRef.current[id];
      const color = isOn ? col.lane[id] : col.muted;
      const y0 = k * rowH;
      const base = y0 + rowH - 3;
      const amp = rowH - 10;
      const raw = edges.map((e) => (arr ? Math.pow(norm(bandMax(arr, e)), 1.4) : 0));
      // 줄마다 모양이 잘 보이게 조금 키운다(가장 높은 곳이 줄 높이의 75% 정도, 최대 2.5배)
      const rowMax = Math.max(...raw);
      const boost = rowMax > 0.02 ? Math.min(2.5, 0.75 / rowMax) : 1;
      const vals = raw.map((v) => Math.min(1, v * boost));
      const step = w / (count - 1);
      const ys = vals.map((v) => base - v * amp);
      g.beginPath();
      g.moveTo(0, base);
      g.lineTo(0, ys[0]);
      for (let i = 1; i < ys.length; i++) {
        const xm = (i - 0.5) * step;
        g.quadraticCurveTo((i - 1) * step, ys[i - 1], xm, (ys[i - 1] + ys[i]) / 2);
      }
      g.lineTo(w, ys[ys.length - 1]);
      g.lineTo(w, base);
      g.closePath();
      const grad = g.createLinearGradient(0, y0, 0, base);
      grad.addColorStop(0, withAlpha(color, isOn ? 0.85 : 0.3));
      grad.addColorStop(1, withAlpha(color, 0.08));
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.globalAlpha = isOn ? 1 : 0.5;
      g.stroke();
      g.globalAlpha = 1;
      // 가장 큰 높이 표시
      let best = 0;
      vals.forEach((v, i) => { if (v > vals[best]) best = i; });
      if (isOn && vals[best] > 0.08) {
        g.fillStyle = col.ink;
        g.beginPath();
        g.arc(best * step, ys[best], 4, 0, Math.PI * 2);
        g.fill();
      }
      if (k > 0) {
        g.strokeStyle = col.hair;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, y0 + 0.5);
        g.lineTo(w, y0 + 0.5);
        g.stroke();
      }
      rowLabel(g, col, id, isOn, 6, y0 + 16);
    });
  }, [ref, size]);
  useAnimationFrame(draw, true);

  return (
    <div className="viz-wrap">
      <Segmented
        label={tx('보기 범위', 'Show')}
        value={split}
        onChange={setSplit}
        options={[
          { value: 'each', label: tx('악기별', 'By instrument') },
          { value: 'all', label: tx('전체', 'All') },
        ]}
      />
      <div className="viz-canvas-box">
        <canvas
          ref={ref}
          className="viz-canvas"
          role="img"
          aria-label={split === 'each'
            ? tx('악기마다 한 줄씩 소리 높이별 크기를 보여 주는 산 모양. 왼쪽 낮은 소리, 오른쪽 높은 소리', 'One row per instrument showing how loud each pitch is. Low sounds on the left, high sounds on the right')
            : tx('소리 높이별 크기를 보여 주는 막대. 왼쪽 낮은 소리, 오른쪽 높은 소리', 'Bars showing how loud each pitch is. Low sounds on the left, high sounds on the right')}
        />
      </div>
      <div className="viz-axis" aria-hidden="true">
        <span>{tx('← 낮은 소리', '← Low sounds')}</span>
        <span>{tx('높은 소리 →', 'High sounds →')}</span>
      </div>
    </div>
  );
}

// ───────── ③ 스펙트로그램 ─────────
const RING_N = 120;
const COLS = 300;
const ROWS = 96;
const COLS_PER_SEC = 50;
interface Slot {
  t: number;
  data: Float32Array;
}

function colormap(v: number): [number, number, number] {
  // 어두운 남색 → 주황 → 연한 노랑(밝을수록 큰 소리). 고정 색(자료 표현용)
  const x = Math.min(1, Math.max(0, v));
  const r = Math.round(10 + 245 * Math.min(1, x * 1.4));
  const gch = Math.round(10 + 230 * Math.max(0, Math.min(1, (x - 0.25) * 1.5)));
  const b = Math.round(30 + 170 * Math.max(0, (x - 0.75) * 4) + 40 * (1 - x));
  return [r, gch, Math.min(255, b)];
}

function SgramView() {
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 190 : 240));
  const off = useRef<HTMLCanvasElement | null>(null);
  const rings = useRef<Record<string, { slots: Slot[]; head: number }>>({});
  const rows = useRef<Int32Array | null>(null);
  const carry = useRef(0);
  const img = useRef<ImageData | null>(null);
  useSmoothing(0);

  useEffect(() => {
    const o = document.createElement('canvas');
    o.width = COLS;
    o.height = ROWS;
    const g = o.getContext('2d');
    if (g) {
      g.fillStyle = '#0a0a14';
      g.fillRect(0, 0, COLS, ROWS);
    }
    off.current = o;
    rows.current = null;
    rings.current = {};
  }, []);

  const draw = useCallback(
    (dtMs: number) => {
      const c = ref.current;
      const g = c?.getContext('2d');
      const o = off.current;
      const ctx = engine.ctx;
      if (!c || !g || !o || !ctx) return;
      const og = o.getContext('2d');
      if (!og) return;
      const { w, h, dpr } = size.current;
      const first = engine.analyser('cajon');
      if (!first) return;
      const bins = first.frequencyBinCount;
      const sr = ctx.sampleRate;
      if (!rows.current || rows.current.length !== ROWS * 2) {
        const r = new Int32Array(ROWS * 2);
        for (let y = 0; y < ROWS; y++) {
          const fHi = F0 * Math.pow(F1 / F0, (ROWS - y) / ROWS);
          const fLo = F0 * Math.pow(F1 / F0, (ROWS - y - 1) / ROWS);
          const i0 = Math.max(1, Math.floor((fLo / (sr / 2)) * bins));
          r[y * 2] = i0;
          r[y * 2 + 1] = Math.max(i0, Math.min(bins - 1, Math.floor((fHi / (sr / 2)) * bins)));
        }
        rows.current = r;
      }
      const playing = engine.state.playing;
      if (playing) {
        // 분석기 읽기: 스템마다 링 한 칸, 시각은 분석 창 중심
        for (const id of INSTRUMENTS) {
          const a = engine.analyser(id);
          if (!a) continue;
          let ring = rings.current[id];
          if (!ring) {
            ring = rings.current[id] = {
              slots: Array.from({ length: RING_N }, () => ({ t: -1, data: new Float32Array(bins) })),
              head: 0,
            };
          }
          const slot = ring.slots[ring.head];
          if (slot.data.length !== bins) slot.data = new Float32Array(bins);
          a.getFloatFrequencyData(slot.data as Float32Array<ArrayBuffer>);
          slot.t = ctx.currentTime - a.fftSize / 2 / sr;
          ring.head = (ring.head + 1) % RING_N;
        }
        // 지금 들리는 시각(스피커 시각)에 가장 가까운 프레임들
        const target = engine.audibleCtxTime();
        const picks: Float32Array[] = [];
        for (const id of INSTRUMENTS) {
          const ring = rings.current[id];
          if (!ring) continue;
          let best: Slot | null = null;
          for (const s of ring.slots) if (s.t >= 0 && (!best || Math.abs(s.t - target) < Math.abs(best.t - target))) best = s;
          if (best) picks.push(best.data);
        }
        carry.current += (Math.min(dtMs, 100) / 1000) * COLS_PER_SEC;
        const cols = Math.floor(carry.current);
        if (cols > 0 && picks.length) {
          carry.current -= cols;
          const minDb = first.minDecibels;
          const maxDb = first.maxDecibels;
          og.drawImage(o, -cols, 0);
          const image = img.current && img.current.width === cols ? img.current : (img.current = og.createImageData(cols, ROWS));
          const r = rows.current;
          for (let y = 0; y < ROWS; y++) {
            let pw = 0;
            for (const d of picks) {
              let m = -Infinity;
              for (let i = r[y * 2]; i <= r[y * 2 + 1]; i++) if (d[i] > m) m = d[i];
              pw += Math.pow(10, Math.max(m, minDb) / 10);
            }
            const v = Math.pow(Math.max(0, (10 * Math.log10(pw || 1e-12) - minDb) / (maxDb - minDb)), 1.2);
            const [rr, gg, bb] = colormap(v);
            for (let x = 0; x < cols; x++) {
              const k = (y * cols + x) * 4;
              image.data[k] = rr;
              image.data[k + 1] = gg;
              image.data[k + 2] = bb;
              image.data[k + 3] = 255;
            }
          }
          og.putImageData(image, COLS - cols, 0);
        }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(o, 0, 0, w, h);
    },
    [ref, size],
  );
  useAnimationFrame(draw, true);

  return (
    <div className="viz-wrap">
      <div className="viz-sgram-row">
        <div className="viz-sgram-axis" aria-hidden="true">
          <span>{tx('높은 소리', 'High sounds')}</span>
          <span>{tx('낮은 소리', 'Low sounds')}</span>
        </div>
        <div className="viz-canvas-box" style={{ background: '#0a0a14' }}>
          <canvas
            ref={ref}
            className="viz-canvas"
            role="img"
            aria-label={tx('시간에 따라 쌓이는 소리 높이 그림. 세로는 높이, 밝을수록 큰 소리', 'Picture of pitch building up over time. Up and down is pitch, brighter means louder')}
          />
        </div>
      </div>
      <div className="viz-axis" aria-hidden="true">
        <span />
        <span>{tx('지금 →', 'Now →')}</span>
      </div>
    </div>
  );
}
