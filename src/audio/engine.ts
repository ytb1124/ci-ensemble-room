// 오디오 엔진. 구성안 7.5절 스케치를 TypeScript로 옮겼다.
// 그래프: 스템마다 [소스 → 뮤트 게인 → 사용자 게인 → 저음 쉘프 → (펼침일 때만 패너) → 분석기] → EQ 저음 → EQ 또렷함 → 밸런스 → 마스터 → 출력
// 단서 질문·보정 클립은 clipIn(EQ 뒤)으로 들어가 마스터 크기·라우팅만 적용된다(4.4절).

import { SONGS, beatToSec, type SongConfig } from '../config/songs';
import { effectiveInstGain, profileStore, updateProfile } from '../store/profile';
import { tx } from '../i18n';
import { createStore } from '../store/storage';
import type { InstrumentId, PlaceholderShape, Profile, SectionDef, SongId, StemId } from '../types';
import { INSTRUMENTS } from '../types';
import { placeholderOnsets, renderStem } from './placeholder';
import { analyzeBuffer, fetchTimeline, rmsAt, type Timeline } from './timeline';

const STEMS: StemId[] = ['piano', 'cajon', 'bass', 'trumpet', 'bassOct'];
const allInst = (v: boolean) => Object.fromEntries(INSTRUMENTS.map((i) => [i, v])) as Record<InstrumentId, boolean>;
const dbToLin = (db: number) => Math.pow(10, db / 20);
const PAN_COMP_DB = 20 * Math.log10(Math.SQRT2); // pan 0 모노 입력의 −3.01 dB 보상
const RAMP = 0.02; // 솔로/뮤트 램프 20 ms (5.1절)
// 자리표시 스템은 피크를 같은 값으로 맞춘다. 네 스템 피크가 겹쳐도 약 −4 dBFS라 마스터 +6 dB에서도 클리핑 여유가 거의 있다.
// 컴프레서·리미터는 쓰지 않는다(구성안 5.4절 설계 선택).
const PLACEHOLDER_PEAK_DB = -16;
const SPREAD_PAN: Record<StemId, number> = { piano: -0.25, cajon: -0.6, bass: 0, trumpet: 0.6, bassOct: 0 };

interface StemNode {
  id: StemId;
  buffer: AudioBuffer | null;
  timeline: Timeline | null;
  src: AudioBufferSourceNode | null;
  mute: GainNode;
  user: GainNode;
  shelf: BiquadFilterNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
  spread: boolean;
  appliedDb: number;
  soloCompDb: number;
}

export interface EngineState {
  ctxState: AudioContextState | 'none';
  unlocked: boolean;
  songId: SongId | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  duration: number;
  /** 현재 선택한 구간(null = 전체) */
  section: SectionDef | null;
  repeat: boolean;
  on: Record<InstrumentId, boolean>;
  solo: InstrumentId | null;
  /** [원래 소리]: 보정(EQ·믹스·저음 도움)을 잠시 끔 */
  bypass: boolean;
  alternating: InstrumentId | null;
  /** 지금 재생 중인 클립 id(단서 질문 A/B 등) */
  clip: string | null;
  sources: Record<StemId, 'file' | 'placeholder'>;
}

const initialState: EngineState = {
  ctxState: 'none',
  unlocked: false,
  songId: null,
  loading: false,
  error: null,
  playing: false,
  duration: 0,
  section: null,
  repeat: false,
  on: allInst(true),
  solo: null,
  bypass: false,
  alternating: null,
  clip: null,
  sources: { piano: 'placeholder', cajon: 'placeholder', bass: 'placeholder', trumpet: 'placeholder', bassOct: 'placeholder' },
};

class AudioEngine {
  readonly store = createStore<EngineState>(initialState);
  ctx: AudioContext | null = null;
  private eqLow!: BiquadFilterNode;
  private eqMid!: BiquadFilterNode;
  private balance!: StereoPannerNode;
  private master!: GainNode;
  /** 클립 입력(EQ 뒤) */
  private clipIn!: GainNode;
  private stems = {} as Record<StemId, StemNode>;
  private song: SongConfig | null = null;
  private preview: Partial<Profile> | null = null;
  private startCtxTime = 0;
  private startOffset = 0;
  private pausedAt = 0;
  private loopRegion: { start: number; end: number } | null = null;
  private monitorTimer: number | null = null;
  private clipSrc: AudioBufferSourceNode | null = null;
  private clipGain: GainNode | null = null;
  private syncTimer: number | null = null;
  private syncStart = 0;
  private syncInterval = 0.6;
  private burst: AudioBuffer | null = null;
  private cache = new Map<string, { buffers: Record<StemId, AudioBuffer>; timelines: Record<StemId, Timeline>; sources: EngineState['sources'] }>();
  private loadSeq = 0;

  constructor() {
    profileStore.subscribe(() => this.applySettings());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.patch({ ctxState: this.ctx ? this.ctx.state : 'none' });
      });
    }
  }

  get state() {
    return this.store.get();
  }
  private patch(p: Partial<EngineState>) {
    this.store.set((s) => ({ ...s, ...p }));
  }

  // ───────── (1) 잠금 해제: [소리 켜기] 탭 안에서 호출 ─────────
  async unlock(): Promise<boolean> {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) {
        try {
          nav.audioSession.type = 'playback'; // 실험적(iOS 무음 스위치), 실기기 확인 필요 [98]
        } catch {
          /* 무시 */
        }
      }
      this.buildGraph();
      this.ctx.onstatechange = () => this.patch({ ctxState: this.ctx!.state });
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* 사용자 활성화 밖이면 실패할 수 있다 */
      }
    }
    const b = new AudioBufferSourceNode(this.ctx, { buffer: this.ctx.createBuffer(1, 1, this.ctx.sampleRate) });
    b.connect(this.ctx.destination);
    b.start();
    const ok = this.ctx.state === 'running';
    this.patch({ ctxState: this.ctx.state, unlocked: ok });
    if (ok) {
      if (!profileStore.get().audioUnlocked) updateProfile({ audioUnlocked: true });
      this.playBurst(); // 짧은 카혼 자리표시 소리
    }
    return ok;
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.eqLow = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 500, gain: 0 });
    this.eqMid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1700, Q: 0.9, gain: 0 });
    this.balance = new StereoPannerNode(ctx, { pan: 0 });
    this.master = new GainNode(ctx, { gain: 1 });
    this.clipIn = new GainNode(ctx, { gain: 1 });
    this.eqLow.connect(this.eqMid).connect(this.balance).connect(this.master).connect(ctx.destination);
    this.clipIn.connect(this.balance);
    for (const id of STEMS) {
      const s: StemNode = {
        id,
        buffer: null,
        timeline: null,
        src: null,
        mute: new GainNode(ctx, { gain: id === 'bassOct' ? 0 : 1 }),
        user: new GainNode(ctx, { gain: 1 }),
        shelf: new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 300, gain: 0 }),
        pan: new StereoPannerNode(ctx, { pan: SPREAD_PAN[id] }),
        analyser: new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.6, minDecibels: -100, maxDecibels: -30 }),
        spread: false,
        appliedDb: 0,
        soloCompDb: 0,
      };
      this.stems[id] = s;
      this.connectStem(s, false);
    }
    this.applySettings();
  }

  private connectStem(s: StemNode, spread: boolean) {
    s.mute.disconnect();
    s.user.disconnect();
    s.shelf.disconnect();
    s.pan.disconnect();
    s.analyser.disconnect();
    // 뮤트를 분석기 앞에 둬서 꺼진 악기는 분석값도 0이 되게 한다(7.5절)
    s.mute.connect(s.user).connect(s.shelf);
    if (spread) s.shelf.connect(s.pan).connect(s.analyser);
    else s.shelf.connect(s.analyser); // 모노 → 스테레오 업믹스는 L=R
    s.analyser.connect(this.eqLow);
    s.spread = spread;
  }

  // ───────── 설정 반영 ─────────
  /** 보정 화면의 A/B 비교: 프로필을 바꾸지 않고 소리만 미리 바꾼다. null이면 해제 */
  setPreview(p: Partial<Profile> | null) {
    this.preview = p;
    this.applySettings();
  }

  private settings(): Profile {
    const base = profileStore.get();
    return this.preview ? { ...base, ...this.preview } : base;
  }

  private ramp(param: AudioParam, value: number, tc = 0.01) {
    const t = this.ctx!.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.setTargetAtTime(value, t, tc);
  }

  applySettings() {
    if (!this.ctx) return;
    const p = this.settings();
    const { bypass } = this.state;
    const songId = this.state.songId;
    this.ramp(this.master.gain, dbToLin(p.masterGainDb));
    this.ramp(this.eqLow.gain, bypass ? 0 : p.eqLowDb);
    this.ramp(this.eqMid.gain, bypass ? 0 : p.eqMidDb);
    this.eqMid.frequency.setValueAtTime(p.eqMidHz, this.ctx.currentTime);
    this.ramp(this.balance.pan, p.stereo ? p.balance : 0);
    const spread = p.stereo && p.spread;
    const inst = this.preview?.instGainDb ?? effectiveInstGain(p, songId);
    for (const id of STEMS) {
      const s = this.stems[id];
      if (s.spread !== spread) this.connectStem(s, spread);
    }
    const assist = bypass ? 'none' : p.bassAssist;
    this.ramp(this.stems.bass.shelf.gain, assist === 'boost' ? 6 : 0);
    for (const id of INSTRUMENTS) this.setStemGain(id, bypass ? 0 : inst[id]);
    this.updateBassOct();
  }

  private soloComp(id: InstrumentId): number {
    const p = this.settings();
    if (this.state.solo !== id || !p.soloLoudnessMatch) return 0;
    const s = this.stems[id];
    // 상한: 6 dB와 피크 여유(−1 dBTP − 스템 피크) 중 작은 값(7.5절)
    const headroom = -1 - (s.timeline?.peakDb ?? -20);
    return Math.max(0, Math.min(s.soloCompDb, 6, headroom));
  }

  private setStemGain(id: InstrumentId, db: number) {
    const s = this.stems[id];
    const total = db + this.soloComp(id);
    s.appliedDb = total;
    this.ramp(s.user.gain, dbToLin(total + (s.spread ? PAN_COMP_DB : 0)));
  }

  private updateBassOct() {
    const p = this.settings();
    const o = this.stems.bassOct;
    const active = !this.state.bypass && p.bassAssist === 'octaveUp' && this.state.on.bass;
    const t = this.ctx!.currentTime;
    o.mute.gain.cancelScheduledValues(t);
    o.mute.gain.setValueAtTime(o.mute.gain.value, t);
    o.mute.gain.linearRampToValueAtTime(active ? 1 : 0, t + RAMP);
    // 원 베이스 아래 −6 dB로 섞는다(4.2절)
    const db = this.stems.bass.appliedDb - 6;
    o.appliedDb = db;
    this.ramp(o.user.gain, dbToLin(db + (o.spread ? PAN_COMP_DB : 0)));
  }

  // ───────── 곡 불러오기 ─────────
  async loadSong(id: SongId): Promise<void> {
    if (!this.ctx) return;
    const shape = profileStore.get().placeholderShape;
    if (this.state.songId === id && this.stems.cajon.buffer && this.loadedShape === shape) return;
    const seq = ++this.loadSeq;
    this.stopSources();
    this.stopAlternate();
    this.song = SONGS[id];
    this.patch({ songId: id, loading: true, error: null, playing: false, section: null, repeat: false, solo: null, on: allInst(true) });
    this.pausedAt = 0;
    this.loopRegion = null;
    try {
      const data = await this.buildSongBuffers(this.song, shape);
      if (seq !== this.loadSeq) return;
      for (const sid of STEMS) {
        this.stems[sid].buffer = data.buffers[sid];
        this.stems[sid].timeline = data.timelines[sid];
      }
      this.computeSoloComp();
      this.loadedShape = shape;
      this.patch({ loading: false, duration: data.buffers.cajon.duration, sources: data.sources });
      for (const i of INSTRUMENTS) this.applyOn(i, true, 0);
      this.applySettings();
    } catch (e) {
      if (seq !== this.loadSeq) return;
      this.patch({ loading: false, error: tx('소리를 불러오지 못했어요. 다시 시도해 주세요.', "We couldn't load the sound. Please try again.") });
      console.warn(e);
    }
  }
  private loadedShape: PlaceholderShape | null = null;

  /** 자리표시 모양을 바꾼 뒤 다시 만든다 */
  async reloadSong() {
    const id = this.state.songId;
    if (!id) return;
    this.patch({ songId: null });
    await this.loadSong(id);
  }

  private async buildSongBuffers(song: SongConfig, shape: PlaceholderShape) {
    const key = `${song.id}:${shape}:${this.ctx!.sampleRate}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const ctx = this.ctx!;
    const buffers = {} as Record<StemId, AudioBuffer>;
    const timelines = {} as Record<StemId, Timeline>;
    const sources = {} as EngineState['sources'];
    // 두 곡을 동시에 디코딩하지 않는다(9절). 스템은 하나씩 처리한다.
    for (const sid of STEMS) {
      const src = song.stems[sid];
      if (src.url) {
        const res = await fetch(src.url);
        if (!res.ok) throw new Error(`${src.url} ${res.status}`);
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        const mono = toMono(ctx, decoded);
        buffers[sid] = mono;
        let tl = analyzeBuffer(mono.getChannelData(0), ctx.sampleRate);
        if (src.timelineUrl) {
          const ext = await fetchTimeline(src.timelineUrl);
          if (ext) tl = { ...tl, ...Object.fromEntries(Object.entries(ext).filter(([, v]) => v != null)) } as Timeline;
        }
        timelines[sid] = tl;
        sources[sid] = 'file';
      } else {
        const data = renderStem(sid, song, ctx.sampleRate, { shape });
        normalizePeak(data, PLACEHOLDER_PEAK_DB);
        const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.copyToChannel(data, 0);
        buffers[sid] = buf;
        timelines[sid] = analyzeBuffer(data, ctx.sampleRate, placeholderOnsets(sid, song, shape));
        sources[sid] = 'placeholder';
      }
      await new Promise((r) => setTimeout(r, 0)); // 화면이 멈추지 않게 양보
    }
    const out = { buffers, timelines, sources };
    this.cache.set(key, out);
    return out;
  }

  /** 솔로 크기 맞춤값 = 합주 크기 − 스템 크기(사전 계산, 7.5절) */
  private computeSoloComp() {
    const ins = INSTRUMENTS.map((i) => this.stems[i].timeline!);
    const mixPow = ins.reduce((a, tl) => a + Math.pow(10, tl.loudnessDb / 10), 0);
    const mixDb = 10 * Math.log10(mixPow);
    for (const i of INSTRUMENTS) this.stems[i].soloCompDb = mixDb - this.stems[i].timeline!.loudnessDb;
  }

  get songConfig() {
    return this.song;
  }

  timeline(id: StemId): Timeline | null {
    return this.stems[id]?.timeline ?? null;
  }

  analyser(id: StemId): AnalyserNode | null {
    return this.stems[id]?.analyser ?? null;
  }

  // ───────── (3) 재생 ─────────
  play(offset?: number) {
    if (!this.ctx || !this.stems.cajon?.buffer) return;
    this.stopClip();
    if (this.ctx.state !== 'running') void this.ctx.resume();
    let off = offset ?? this.pausedAt;
    const dur = this.state.duration;
    const sec = this.state.section;
    const region = sec ? { start: sec.start, end: sec.end } : { start: 0, end: dur };
    if (off < region.start || off >= region.end - 0.05) off = region.start;
    this.loopRegion = this.state.repeat ? region : null;
    const t0 = this.ctx.currentTime + 0.05; // 모든 스템을 같은 시각에 시작
    for (const id of STEMS) {
      const s = this.stems[id];
      if (s.src) {
        const old = s.src;
        old.onended = () => old.disconnect();
        old.stop(t0); // 새 소스와 같은 시각에 교대(무음 구간 없음)
      }
      s.src = new AudioBufferSourceNode(this.ctx, {
        buffer: s.buffer,
        loop: !!this.loopRegion,
        loopStart: this.loopRegion?.start ?? 0,
        loopEnd: this.loopRegion?.end ?? 0,
      });
      s.src.connect(s.mute);
      s.src.start(t0, off);
    }
    this.startCtxTime = t0;
    this.startOffset = off;
    this.patch({ playing: true });
    this.startMonitor();
  }

  pause() {
    if (!this.ctx) return;
    this.pausedAt = this.position();
    this.stopSources();
    this.patch({ playing: false });
  }

  togglePlay() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const clamped = Math.max(0, Math.min(t, this.state.duration - 0.05));
    this.pausedAt = clamped;
    if (this.state.playing) this.play(clamped);
  }

  /** 구간 선택(null = 전체). repeat = 그 구간을 반복 */
  setSection(section: SectionDef | null, repeat: boolean) {
    const changed = section?.id !== this.state.section?.id;
    this.patch({ section, repeat });
    const start = section ? section.start : 0;
    if (this.state.playing) this.play(changed ? start : this.position());
    else if (changed) this.pausedAt = start;
  }

  private stopSources() {
    for (const id of STEMS) {
      const s = this.stems[id];
      if (s?.src) {
        try {
          s.src.stop();
        } catch {
          /* 이미 멈춤 */
        }
        s.src.disconnect();
        s.src = null;
      }
    }
    this.stopMonitor();
  }

  /** 재생 위치(스피커 지연 미반영). 일시정지·구간 처리용 */
  position(): number {
    if (!this.ctx || !this.state.playing) return this.pausedAt;
    return this.fold(this.ctx.currentTime - this.startCtxTime + this.startOffset);
  }

  private fold(t: number) {
    const L = this.loopRegion;
    if (L && t >= L.end) t = L.start + ((t - L.start) % (L.end - L.start));
    return Math.max(0, t);
  }

  // ───────── (4) 지연 보정: 시각 계산 함수는 하나 ─────────
  /** 지금 스피커에서 나는 소리의 컨텍스트 시각 */
  audibleCtxTime(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const userOffsetSec = profileStore.get().sync.userOffsetMs / 1000; // + = 그림을 더 늦춤
    const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime && ts.contextTime > 0 && ts.performanceTime)
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000 - userOffsetSec;
    const out = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    return ctx.currentTime - (ctx.baseLatency || 0) - out - userOffsetSec;
  }

  /** 지금 들리는 곡 위치(초). 레인·연주자 애니메이션·탐색 보기 모두 이 값을 쓴다 */
  songTime(): number {
    if (!this.ctx || !this.state.playing) return this.pausedAt;
    const t = this.audibleCtxTime() - this.startCtxTime + this.startOffset;
    if (t < this.startOffset) return this.startOffset;
    return this.fold(t);
  }

  /** 연주자 그림 움직임 크기(0–1): 미리 분석한 RMS × 사용자 볼륨 × 켬/끔(5.2절) */
  level(id: InstrumentId): number {
    if (!this.state.playing || !this.state.on[id]) return 0;
    const s = this.stems[id];
    if (!s) return 0;
    return Math.min(1, rmsAt(s.timeline ?? undefined, this.songTime()) * dbToLin(s.appliedDb));
  }

  latencyInfo() {
    const c = this.ctx;
    return {
      sampleRate: c?.sampleRate ?? null,
      baseLatency: c?.baseLatency ?? null,
      outputLatency: c && typeof c.outputLatency === 'number' ? c.outputLatency : null,
      outputTimestamp: !!c?.getOutputTimestamp,
    };
  }

  // ───────── 솔로 · 켜고 끄기 ─────────
  private applyOn(id: InstrumentId, on: boolean, fade = RAMP) {
    const g = this.stems[id].mute.gain;
    const t = this.ctx!.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 1 : 0, t + Math.max(fade, 0.001));
  }

  private setOnMap(on: Record<InstrumentId, boolean>, solo: InstrumentId | null) {
    if (!this.ctx) return;
    this.patch({ on, solo });
    for (const i of INSTRUMENTS) this.applyOn(i, on[i]);
    this.applySettings(); // 솔로 크기 맞춤 반영
  }

  /** 한 악기만(솔로). null이면 모두 함께 */
  solo(id: InstrumentId | null) {
    if (id === null) return this.allOn();
    const on = allInst(false);
    on[id] = true;
    this.setOnMap(on, id);
  }

  setOn(id: InstrumentId, value: boolean) {
    this.setOnMap({ ...this.state.on, [id]: value }, null);
  }

  allOn() {
    this.stopAlternate();
    this.setOnMap(allInst(true), null);
  }

  setBypass(v: boolean) {
    this.patch({ bypass: v });
    this.applySettings();
  }

  // ───────── 번갈아 듣기: 한 악기를 2마디마다 켰다 껐다(5.1절) ─────────
  private altTimer: number | null = null;
  startAlternate(id: InstrumentId) {
    this.stopAlternate();
    if (!this.song) return;
    const bar = beatToSec(this.song, this.song.meter) - beatToSec(this.song, 0);
    const period = bar * 2;
    this.patch({ alternating: id });
    this.setOnMap(allInst(true), null);
    let last: boolean | null = null;
    this.altTimer = window.setInterval(() => {
      if (!this.state.playing) return;
      const t = this.position() - this.song!.startOffsetSec;
      const on = Math.floor(t / period) % 2 === 0;
      if (on !== last) {
        last = on;
        this.patch({ on: { ...this.state.on, [id]: on } });
        this.applyOn(id, on);
        this.updateBassOct();
      }
    }, 30);
  }

  stopAlternate() {
    if (this.altTimer !== null) window.clearInterval(this.altTimer);
    this.altTimer = null;
    if (this.state.alternating) this.patch({ alternating: null });
  }

  // ───────── 재생 감시(곡 끝, 구간 끝) ─────────
  private startMonitor() {
    this.stopMonitor();
    this.monitorTimer = window.setInterval(() => {
      if (!this.state.playing || this.loopRegion) return;
      const end = this.state.section ? this.state.section.end : this.state.duration;
      const raw = this.ctx!.currentTime - this.startCtxTime + this.startOffset;
      if (raw >= end) {
        this.pause();
        this.pausedAt = this.state.section ? this.state.section.start : 0;
      }
    }, 50);
  }
  private stopMonitor() {
    if (this.monitorTimer !== null) window.clearInterval(this.monitorTimer);
    this.monitorTimer = null;
  }

  // ───────── 클립(단서 질문 A/B, 보정 미리 듣기) ─────────
  /**
   * 마스터 크기와 라우팅(모노/스테레오, 좌우)만 적용하고 EQ·믹스·저음 도움은 적용하지 않는다(4.4절).
   * 다른 클립이나 곡 재생은 멈춘다.
   */
  playClip(buffer: AudioBuffer, id: string, opts: { loop?: boolean; onEnded?: () => void } = {}) {
    if (!this.ctx) return;
    if (this.state.playing) this.pause();
    this.stopClip();
    const g = new GainNode(this.ctx, { gain: 1 });
    const src = new AudioBufferSourceNode(this.ctx, { buffer, loop: !!opts.loop });
    src.connect(g).connect(this.clipIn);
    src.onended = () => {
      if (this.clipSrc === src) {
        this.clipSrc = null;
        this.patch({ clip: null });
        opts.onEnded?.();
      }
      g.disconnect();
    };
    src.start(this.ctx.currentTime + 0.02);
    this.clipSrc = src;
    this.clipGain = g;
    this.patch({ clip: id });
  }

  stopClip() {
    if (this.clipSrc) {
      const src = this.clipSrc;
      this.clipSrc = null;
      const g = this.clipGain!;
      const t = this.ctx!.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.01);
      try {
        src.stop(t + 0.012);
      } catch {
        /* 무시 */
      }
      this.patch({ clip: null });
    }
  }

  // ───────── 화면-소리 맞추기: 0.6초 간격 짧은 소리(7.4절) ─────────
  private getBurst(): AudioBuffer {
    if (this.burst) return this.burst;
    const ctx = this.ctx!;
    const n = Math.round(0.12 * ctx.sampleRate);
    const data = new Float32Array(n);
    let b = 0;
    for (let i = 0; i < n; i++) {
      // 짧은 핑크풍 잡음 버스트(슬랩 톤 자리표시)
      b = 0.97 * b + (Math.random() * 2 - 1) * 0.3;
      data[i] = b * Math.exp(-i / ctx.sampleRate / 0.03) * 0.9;
    }
    this.burst = ctx.createBuffer(1, n, ctx.sampleRate);
    this.burst.copyToChannel(data, 0);
    return this.burst;
  }

  playBurst(at?: number) {
    if (!this.ctx) return;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.getBurst() });
    src.connect(this.clipIn);
    src.start(at ?? this.ctx.currentTime + 0.02);
  }

  startSyncClicks(interval = 0.6) {
    if (!this.ctx) return;
    this.stopSyncClicks();
    if (this.state.playing) this.pause();
    this.syncInterval = interval;
    this.syncStart = this.ctx.currentTime + 0.1;
    let next = 0;
    const schedule = () => {
      const horizon = this.ctx!.currentTime + 0.3;
      while (this.syncStart + next * interval < horizon) {
        this.playBurst(this.syncStart + next * interval);
        next++;
      }
    };
    schedule();
    this.syncTimer = window.setInterval(schedule, 100);
  }

  stopSyncClicks() {
    if (this.syncTimer !== null) window.clearInterval(this.syncTimer);
    this.syncTimer = null;
  }

  /** 깜빡임 표시용: 지금 들리는 클릭으로부터 지난 시간(초). 클릭 중이 아니면 null */
  syncPhase(): number | null {
    if (this.syncTimer === null) return null;
    const t = this.audibleCtxTime() - this.syncStart;
    if (t < 0) return null;
    return t % this.syncInterval;
  }

  /** 단서 질문 편집본 등 버퍼를 만들 때 쓰는 샘플레이트 */
  get sampleRate() {
    return this.ctx?.sampleRate ?? 48000;
  }

  /** 곡의 구간 목록(초) */
  sections(songId: SongId): SectionDef[] {
    const song = SONGS[songId];
    const lines = song.lines.map((l) => ({
      id: l.id,
      label: l.label,
      start: beatToSec(song, l.startBeat),
      end: beatToSec(song, l.endBeat),
    }));
    return lines;
  }
}

function toMono(ctx: AudioContext, b: AudioBuffer): AudioBuffer {
  if (b.numberOfChannels === 1) return b;
  const out = ctx.createBuffer(1, b.length, b.sampleRate);
  const d = out.getChannelData(0);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const ch = b.getChannelData(c);
    for (let i = 0; i < ch.length; i++) d[i] += ch[i] / b.numberOfChannels;
  }
  return out;
}

/** 피크를 목표 dBFS로 맞춘다 */
export function normalizePeak(data: Float32Array, targetDb: number) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  if (!peak) return;
  const g = dbToLin(targetDb) / peak;
  for (let i = 0; i < data.length; i++) data[i] *= g;
}

/** 소리가 나는 부분의 RMS를 목표 dBFS로 맞춘다 */
export function normalizeTo(data: Float32Array, targetDb: number) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] * data[i];
    if (v > 1e-7) {
      s += v;
      n++;
    }
  }
  if (!n) return;
  const cur = 10 * Math.log10(s / n);
  const g = dbToLin(targetDb - cur);
  for (let i = 0; i < data.length; i++) data[i] *= g;
}

export const engine = new AudioEngine();
if (import.meta.env.DEV) (window as unknown as { __engine: AudioEngine }).__engine = engine;
