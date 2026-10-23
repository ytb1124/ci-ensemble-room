// 탐색 보기(구성안 7.1, 7.5 (5)): 파형/엔벨로프, 스펙트럼 막대, 스펙트로그램.
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { effectiveInstGain, profileStore } from '../../store/profile';
import { rmsAt } from '../../audio/timeline';
import { Segmented } from '../ui/controls';
import type { InstrumentId } from '../../types';
import { INSTRUMENTS, INSTRUMENT_SHORT } from '../../types';
import { readColors, useFitCanvas, type VizColors } from './Lanes';
import './viz.css';

type View = 'wave' | 'spec' | 'sgram';
const HELP: Record<View, { title: string; text: string }> = {
  wave: { title: '파형 보기', text: '선이 높을수록 큰 소리예요. 가운데 세로선이 지금 들리는 순간이에요.' },
  spec: { title: '스펙트럼 막대', text: '왼쪽은 낮은 소리, 오른쪽은 높은 소리예요. 막대가 높을수록 그 높이의 소리가 커요.' },
  sgram: { title: '스펙트로그램', text: '세로 = 높이, 밝을수록 큰 소리예요. 시간은 오른쪽으로 쌓여요.' },
};
const FONT = "system-ui, -apple-system, 'Noto Sans KR', sans-serif";

export function Explore(p: { on: Record<InstrumentId, boolean> }) {
  const [view, setView] = useState<View>('wave');
  return (
    <div className="viz-explore">
      <p className="viz-note">익숙해지려면 여러 번 봐야 해요. 소리를 들으면서 보세요.</p>
      <Segmented
        label="탐색 보기"
        hideLabel
        value={view}
        onChange={setView}
        options={[
          { value: 'wave', label: '파형' },
          { value: 'spec', label: '스펙트럼' },
          { value: 'sgram', label: '스펙트로그램' },
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

const DASH: Record<InstrumentId, number[]> = { cajon: [], bass: [10, 5], trumpet: [2, 5] };
function Legend() {
  const [c, setC] = useState<VizColors | null>(null);
  useEffect(() => {
    setC(readColors(document.documentElement));
  }, []);
  return (
    <div className="viz-legend" aria-label="악기 색과 선 모양">
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

// ───────── ① 파형/엔벨로프 ─────────
function WaveView({ on }: { on: Record<InstrumentId, boolean> }) {
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 170 : 210));
  const colors = useRef<VizColors | null>(null);
  const n = useRef(0);
  const onRef = useRef(on);
  onRef.current = on;
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
    // 바닥선
    g.strokeStyle = col.hair;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h - 8.5);
    g.lineTo(w, h - 8.5);
    g.stroke();
    for (const id of INSTRUMENTS) {
      const tl = engine.timeline(id);
      if (!tl) continue;
      const isOn = onRef.current[id];
      const gain = isOn ? Math.pow(10, (inst[id] ?? 0) / 20) : 0;
      g.beginPath();
      g.moveTo(0, h - 8);
      for (let x = 0; x <= w; x += 2) {
        const v = Math.min(1, rmsAt(tl, t + (x - px) / pps) * gain);
        g.lineTo(x, h - 8 - v * (h - 24));
      }
      g.setLineDash(DASH[id]);
      g.lineWidth = id === 'trumpet' ? 3 : 2.5;
      g.strokeStyle = isOn ? col.lane[id] : col.muted;
      g.globalAlpha = isOn ? 1 : 0.5;
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
    g.strokeStyle = col.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px, 2);
    g.lineTo(px, h - 2);
    g.stroke();
  }, [ref, size]);
  useAnimationFrame(draw, true);
  return (
    <div className="viz-canvas-box">
      <canvas ref={ref} className="viz-canvas" role="img" aria-label="악기별 소리 크기 곡선. 선이 높을수록 큰 소리" />
    </div>
  );
}

// ───────── ② 스펙트럼 막대 ─────────
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

function SpectrumView({ on }: { on: Record<InstrumentId, boolean> }) {
  const [mode, setMode] = useState<'all' | 'each'>('all');
  const { ref, size } = useFitCanvas((w) => (w < 520 ? 190 : 230));
  const colors = useRef<VizColors | null>(null);
  const n = useRef(0);
  const bufs = useRef<Record<string, Float32Array>>({});
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onRef = useRef(on);
  onRef.current = on;
  useSmoothing(0.6);

  const draw = useCallback(() => {
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
    const count = w < 420 ? 28 : 44;
    const edges = bandEdges(bins, sr, count);
    const norm = (v: number) => (Math.max(v, minDb) - minDb) / (maxDb - minDb);
    const bandMax = (arr: Float32Array, [i0, i1]: [number, number]) => {
      let m = -Infinity;
      for (let i = i0; i <= i1; i++) if (arr[i] > m) m = arr[i];
      return m;
    };
    const panels: { id: InstrumentId | null; vals: number[] }[] = [];
    if (modeRef.current === 'all') {
      panels.push({
        id: null,
        vals: edges.map((e) => {
          let pw = 0;
          for (const id of INSTRUMENTS) {
            const arr = data[id];
            if (arr) pw += Math.pow(10, Math.max(bandMax(arr, e), minDb) / 10);
          }
          return norm(10 * Math.log10(pw || 1e-12));
        }),
      });
    } else {
      for (const id of INSTRUMENTS) {
        const arr = data[id];
        panels.push({ id, vals: edges.map((e) => (arr ? norm(bandMax(arr, e)) : 0)) });
      }
    }
    const ph = h / panels.length;
    panels.forEach((pn, k) => {
      const y0 = k * ph;
      const bw = w / count;
      const isOn = pn.id ? onRef.current[pn.id] : true;
      const color = pn.id ? (isOn ? col.lane[pn.id] : col.muted) : col.primary;
      g.fillStyle = color;
      g.globalAlpha = isOn ? 1 : 0.4;
      pn.vals.forEach((v, i) => {
        const bh = Math.max(2, v * (ph - 22));
        g.fillRect(i * bw + 1, y0 + ph - 4 - bh, Math.max(1, bw - 2), bh);
      });
      g.globalAlpha = 1;
      if (pn.id) {
        g.font = `700 14px ${FONT}`;
        g.textBaseline = 'top';
        g.fillStyle = col.body;
        g.fillText(INSTRUMENT_SHORT[pn.id] + (isOn ? '' : ' (꺼짐)'), 6, y0 + 3);
      }
      if (k > 0) {
        g.strokeStyle = col.hair;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, y0 + 0.5);
        g.lineTo(w, y0 + 0.5);
        g.stroke();
      }
    });
  }, [ref, size]);
  useAnimationFrame(draw, true);

  return (
    <div className="viz-wrap">
      <Segmented
        label="보기 범위"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'all', label: '전체' },
          { value: 'each', label: '악기별' },
        ]}
      />
      <div className="viz-canvas-box">
        <canvas ref={ref} className="viz-canvas" role="img" aria-label="소리 높이별 크기를 보여 주는 막대. 왼쪽 낮은 소리, 오른쪽 높은 소리" />
      </div>
      <div className="viz-axis" aria-hidden="true">
        <span>낮은 소리</span>
        <span>높은 소리</span>
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
          <span>높은 소리</span>
          <span>낮은 소리</span>
        </div>
        <div className="viz-canvas-box" style={{ background: '#0a0a14' }}>
          <canvas
            ref={ref}
            className="viz-canvas"
            role="img"
            aria-label="시간에 따라 쌓이는 소리 높이 그림. 세로는 높이, 밝을수록 큰 소리"
          />
        </div>
      </div>
      <div className="viz-axis" aria-hidden="true">
        <span />
        <span>지금 →</span>
      </div>
    </div>
  );
}
