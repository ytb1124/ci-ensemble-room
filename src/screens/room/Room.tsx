import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { engine, useEngineState } from '../../audio/useEngine';
import { InstrumentCard } from '../../components/instruments/InstrumentCard';
import { Lanes } from '../../components/viz/Lanes';
import { Explore } from '../../components/viz/Explore';
import { SyncCard } from '../../components/viz/SyncCard';
import { Segmented } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { SONGS } from '../../config/songs';
import { logEvent } from '../../store/log';
import { updateProfile, useProfile } from '../../store/profile';
import { useProbeState } from '../../store/probe';
import {
  INSTRUMENTS, INSTRUMENT_LABEL,
  type InstrumentId, type MotionLevel, type RoomMode, type SongId, type ViewMode,
} from '../../types';
import { TransportBar } from './TransportBar';
import { AdvancedPanel } from './AdvancedPanel';
import { GuideCards } from './GuideCards';
import { ListenFirst } from './ListenFirst';
import './room.css';

// 세션(페이지를 연 동안) 기억
const openedSongs = new Set<SongId>();
let syncCardDismissed = false;
let recalibPending = false;

const MOTIONS: { v: MotionLevel; label: string }[] = [
  { v: 'off', label: '끄기' },
  { v: 'calm', label: '차분' },
  { v: 'normal', label: '보통' },
  { v: 'vivid', label: '화려' },
];

export default function Room() {
  const params = useParams();
  const song: SongId = params.song === 'song2' ? 'song2' : 'hbd';
  return <RoomInner key={song} song={song} />;
}

function RoomInner({ song }: { song: SongId }) {
  const profile = useProfile();
  const st = useEngineState();
  const probe = useProbeState();
  const nav = useNavigate();
  const sections = useMemo(() => engine.sections(song), [song]);

  const [mode, setMode] = useState<RoomMode>('solo');
  const [view, setViewState] = useState<ViewMode>(profile.viz.defaultView);
  const [listenFirst, setListenFirst] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [showCalib, setShowCalib] = useState(false);
  const [showRecalib, setShowRecalib] = useState(false);
  const [showSync, setShowSync] = useState(false);
  // 맞추기 카드는 소리를 멈추고 클릭음을 내므로, 먼저 묻고 사용자가 [맞추기]를 누를 때만 연다
  const [syncOpen, setSyncOpen] = useState(false);
  const [blind, setBlind] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [blindNums, setBlindNums] = useState<Record<InstrumentId, 1 | 2 | 3>>({ cajon: 1, bass: 2, trumpet: 3 });
  const [live, setLive] = useState('');

  // 마운트: 곡 불러오기, 듣기 우선 흐름, 곡 바꾼 뒤 카드
  useEffect(() => {
    void engine.loadSong(song);
    if (profile.viz.listenFirst && !openedSongs.has(song)) {
      setListenFirst(true);
      setViewState('off');
    }
    openedSongs.add(song);
    if (recalibPending) {
      recalibPending = false;
      setShowRecalib(true);
    }
    return () => {
      engine.pause();
      engine.stopAlternate();
      engine.setPreview(null);
      engine.setBypass(false);
      document.documentElement.style.removeProperty('--transport-h');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  // 재생 막대 높이만큼 본문 여백
  useEffect(() => {
    const el = document.querySelector('.room-transport');
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--transport-h', `${(el as HTMLElement).offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 스페이스 = 재생/일시정지
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      logEvent({ type: engine.state.playing ? 'pause' : 'play', songPos: engine.position(), song });
      engine.togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [song]);

  const setView = useCallback((v: ViewMode, fromUser = true) => {
    setViewState(v);
    if (fromUser) logEvent({ type: 'view', value: v });
  }, []);

  // 처음 시각화를 켤 때 30초 맞춤 카드
  useEffect(() => {
    if (view !== 'off' && !syncCardDismissed && profile.sync.calibratedAt == null && profile.sync.method === 'auto') {
      setShowSync(true);
    }
  }, [view, profile.sync.calibratedAt, profile.sync.method]);

  const setMotion = (m: MotionLevel) => {
    updateProfile({ viz: { ...profile.viz, motion: m } });
    logEvent({ type: 'motion', value: m });
  };

  // ───────── 연주자 ─────────
  const press = (id: InstrumentId, asToggle: boolean) => {
    engine.stopAlternate();
    const pos = engine.position();
    if (asToggle) {
      const on = !st.on[id];
      engine.setOn(id, on);
      logEvent({ type: 'toggle', instrument: id, mode: 'toggle', songPos: pos, song, on });
      setLive(`${INSTRUMENT_LABEL[id]} ${on ? '켜짐' : '꺼짐'}`);
    } else if (st.solo === id) {
      engine.allOn();
      logEvent({ type: 'unsolo', instrument: id, mode: 'solo', songPos: pos, song });
      setLive('모두 함께 들려요');
    } else {
      engine.solo(id);
      logEvent({ type: 'solo', instrument: id, mode: 'solo', songPos: pos, song });
      setLive(`${INSTRUMENT_LABEL[id]}만 들려요`);
    }
  };
  const allTogether = () => {
    engine.allOn();
    if (st.solo) logEvent({ type: 'unsolo', instrument: st.solo, mode, songPos: engine.position(), song });
    setLive('모두 함께 들려요');
  };
  const soloFromCard = (id: InstrumentId) => {
    engine.stopAlternate();
    engine.solo(id);
    logEvent({ type: 'solo', instrument: id, mode, songPos: engine.position(), song });
    setLive(`${INSTRUMENT_LABEL[id]}만 들려요`);
    if (!engine.state.playing) engine.play();
  };

  const changeMode = (m: RoomMode) => {
    setMode(m);
    setLive(m === 'solo' ? '한 악기만 듣기' : '켜고 끄기');
  };

  const toggleBlind = (v: boolean) => {
    setBlind(v);
    setRevealed(false);
    if (v) {
      const nums = [1, 2, 3].sort(() => Math.random() - 0.5) as (1 | 2 | 3)[];
      setBlindNums({ cajon: nums[0], bass: nums[1], trumpet: nums[2] });
    }
  };

  // ───────── 구간·보기 컨트롤 ─────────
  const controls = (
    <>
      <div className="room-pills" role="group" aria-label="구간">
        <span className="small" style={{ fontWeight: 600 }}>구간</span>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="room-pill"
            aria-pressed={st.section?.id === s.id}
            title={SONGS[song].lines.find((l) => l.id === s.id)?.note}
            onClick={() => {
              const sel = st.section?.id === s.id ? null : s;
              engine.setSection(sel, st.repeat && !!sel);
              if (sel && st.repeat) logEvent({ type: 'loop', section: sel.id, song });
            }}
          >
            {s.label}
          </button>
        ))}
        <button type="button" className="room-pill" aria-pressed={st.section === null} onClick={() => engine.setSection(null, false)}>
          전체
        </button>
        <button
          type="button"
          className="room-pill"
          aria-pressed={st.repeat}
          disabled={!st.section}
          onClick={() => {
            engine.setSection(st.section, !st.repeat);
            if (!st.repeat && st.section) logEvent({ type: 'loop', section: st.section.id, song });
          }}
        >
          <Icon name="repeat" size={18} />
          반복
        </button>
      </div>
      <Segmented<ViewMode>
        label="보기"
        value={view}
        onChange={(v) => setView(v)}
        options={[{ value: 'off', label: '끔' }, { value: 'lanes', label: '레인' }, { value: 'explore', label: '탐색' }]}
      />
      <label className="row" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>움직임</span>
        <select className="room-select" value={profile.viz.motion} onChange={(e) => setMotion(e.target.value as MotionLevel)}>
          {MOTIONS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
        </select>
      </label>
    </>
  );
  const line3Note = SONGS[song].lines.find((l) => l.id === 'line3')?.note;

  const changeSong = (id: SongId) => {
    setShowSwitch(false);
    if (id === song) return;
    recalibPending = true;
    nav(`/room/${id}`);
  };

  const sets = probe.completedSets;
  const probeTarget = !sets.includes(1) ? '/probe/set1' : !sets.includes(2) ? '/probe/set2' : '/report';

  return (
    <main className="page page-narrow">
      <div className="stack-lg">
        <header className="room-head">
          <button type="button" className="btn btn-sm" aria-expanded={showSwitch} onClick={() => setShowSwitch(!showSwitch)}>
            <Icon name="chevronLeft" size={18} />곡 바꾸기
          </button>
          <h1>{SONGS[song].title}</h1>
          <button type="button" className="btn btn-sm" aria-expanded={showCalib} onClick={() => setShowCalib(!showCalib)}>
            <Icon name="sliders" size={18} />소리 맞춤
          </button>
        </header>

        {showSwitch && (
          <div className="card room-songlist" role="group" aria-label="곡 고르기">
            {(['hbd', 'song2'] as SongId[]).map((id) => (
              <button key={id} type="button" className="btn" aria-pressed={id === song} onClick={() => changeSong(id)}>
                <span>{SONGS[id].title}</span>
                {SONGS[id].undecided && <span className="tag">미정</span>}
              </button>
            ))}
          </div>
        )}
        {showCalib && (
          <div className="card stack" role="group" aria-label="소리 맞춤 단계">
            <p style={{ margin: 0 }}>다시 맞출 단계를 골라 주세요.</p>
            <div className="row">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Link key={n} className="btn btn-sm" to={`/calibrate/${n}?only=1&next=/room/${song}`}>
                  {'①②③④⑤⑥'[n - 1]} 단계
                </Link>
              ))}
            </div>
          </div>
        )}
        {showRecalib && (
          <div className="card card-tone peach stack" role="region" aria-label="크기 다시 맞추기">
            <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>크기만 다시 맞출까요? (10초)</p>
            <div className="row">
              <Link className="btn btn-primary btn-sm" to={`/calibrate/2?only=1&next=/room/${song}`}>맞추기</Link>
              <button type="button" className="btn btn-sm" onClick={() => setShowRecalib(false)}>건너뛰기</button>
            </div>
          </div>
        )}

        {st.loading && <p className="muted" role="status">곡을 불러오는 중이에요…</p>}
        {st.error && <p role="alert" style={{ color: 'var(--error)' }}>{st.error}</p>}

        {listenFirst && (
          <ListenFirst
            onView={(v) => setView(v)}
            onDone={() => {
              setListenFirst(false);
              setView(profile.viz.defaultView, false);
            }}
          />
        )}

        <Segmented<RoomMode>
          label="모드"
          value={mode}
          onChange={changeMode}
          options={[{ value: 'solo', label: '한 악기만' }, { value: 'toggle', label: '켜고 끄기' }]}
        />

        <div className="room-cards">
          {INSTRUMENTS.map((id) => (
            <InstrumentCard
              key={id}
              id={id}
              on={st.on[id]}
              selected={st.solo === id}
              mode={mode}
              motion={profile.viz.motion}
              animate={profile.viz.motion !== 'off'}
              blindNumber={blind ? blindNums[id] : undefined}
              revealed={revealed}
              onPress={() => press(id, mode === 'toggle')}
              onLongPress={() => press(id, mode === 'solo')}
            />
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={allTogether}>
          모두 함께 듣기
        </button>
        <p className="room-live" role="status" aria-live="polite">{live}</p>

        {blind && !revealed && (
          <div className="card card-soft row" role="note" style={{ justifyContent: 'space-between' }}>
            <p>눈 가리고 듣기 중이라 그림 보기를 잠시 숨겼어요. 켜고 끈 뒤 [공개]를 눌러 보세요.</p>
            <button type="button" className="btn btn-primary" onClick={() => { setRevealed(true); logEvent({ type: 'blind', value: 'reveal' }); }}>공개</button>
          </div>
        )}
        {view !== 'off' && !(blind && !revealed) && (
          <div className="room-viz">
            {view === 'lanes' ? (
              <Lanes on={st.on} pitchLines={profile.viz.pitchLines} bassEmphasis={profile.bassVizEmphasis} motion={profile.viz.motion} />
            ) : (
              <Explore on={st.on} />
            )}
          </div>
        )}
        {showSync && view !== 'off' && (
          syncOpen ? (
            <SyncCard onClose={() => { syncCardDismissed = true; setShowSync(false); setSyncOpen(false); }} />
          ) : (
            <div className="card card-soft stack" role="region" aria-label="화면과 소리 맞추기 제안">
              <h3>화면과 소리를 맞춰 볼까요? (30초)</h3>
              <p>그림이 소리보다 늦거나 빠르면 맞출 수 있어요. 맞추는 동안 음악은 잠시 멈춰요.</p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => setSyncOpen(true)}>맞추기</button>
                <button type="button" className="btn" onClick={() => { syncCardDismissed = true; setShowSync(false); }}>나중에</button>
              </div>
            </div>
          )
        )}

        <div className="room-body-controls">{controls}</div>
        {st.section?.id === 'line3' && line3Note && <p className="small muted" style={{ margin: 0 }}>3줄: {line3Note}</p>}

        <AdvancedPanel song={song} blind={blind} onBlind={toggleBlind} onReveal={() => { setRevealed(true); logEvent({ type: 'blind', value: 'reveal' }); }} revealed={revealed} />

        <GuideCards song={song} onSolo={soloFromCard} />

        <div className="row">
          <Link className="btn btn-block" to={probeTarget}>
            {probeTarget === '/report' ? '리포트 보기' : '잠깐 질문 하러 가기 (4–5분)'}
            <Icon name="chevronRight" size={18} />
          </Link>
          {sets.includes(1) && sets.includes(2) && (
            <Link className="btn btn-sm btn-ghost" to="/probe/set1">질문 다시 보기</Link>
          )}
        </div>
      </div>
      <TransportBar song={song} extra={controls} />
    </main>
  );
}
