import { useRef, type ReactNode } from 'react';
import { engine, useAnimationFrame, useEngineState } from '../../audio/useEngine';
import { Icon } from '../../components/ui/Icon';
import { logEvent } from '../../store/log';
import type { SongId } from '../../types';
import { tx } from '../../i18n';

function fmt(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TransportBar({ song, extra }: { song: SongId; extra?: ReactNode }) {
  const st = useEngineState();
  const timeRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const lastText = useRef('');
  const dur = st.duration;

  useAnimationFrame(() => {
    const t = engine.songTime();
    const txt = `${fmt(t)} / ${fmt(dur)}`;
    if (txt !== lastText.current && timeRef.current) {
      lastText.current = txt;
      timeRef.current.textContent = txt;
      rangeRef.current?.setAttribute('aria-valuetext', txt.replace('/', tx('중', 'of')));
    }
    if (!dragging.current && rangeRef.current) rangeRef.current.value = String(t);
  }, true);

  const toggle = () => {
    const was = st.playing;
    logEvent({ type: was ? 'pause' : 'play', songPos: engine.position(), song });
    engine.togglePlay();
  };
  const commitSeek = () => {
    dragging.current = false;
    logEvent({ type: 'seek', songPos: engine.position(), song });
  };

  return (
    <div className="room-transport" role="region" aria-label={tx('재생 막대', 'Playback bar')}>
      <div className="room-transport-in">
        <div className="room-tp-main">
          <button
            type="button"
            className="btn btn-primary room-play"
            onClick={toggle}
            aria-label={st.playing ? tx('일시정지', 'Pause') : tx('재생', 'Play')}
            disabled={st.loading || dur === 0}
          >
            <Icon name={st.playing ? 'pause' : 'play'} size={26} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-round"
            aria-label={tx('처음으로', 'Back to start')}
            disabled={dur === 0}
            onClick={() => {
              engine.seek(st.section ? st.section.start : 0);
              logEvent({ type: 'seek', songPos: engine.position(), song });
            }}
          >
            <Icon name="restart" size={20} />
            <span className="sr-only">{tx('처음으로', 'Back to start')}</span>
          </button>
          <span ref={timeRef} className="room-tp-time" aria-hidden="true">0:00 / {fmt(dur)}</span>
          <input
            ref={rangeRef}
            className="range room-tp-seek"
            type="range"
            min={0}
            max={Math.max(dur, 0.1)}
            step={0.1}
            defaultValue={0}
            aria-label={tx('재생 위치', 'Playback position')}
            disabled={dur === 0}
            onPointerDown={() => (dragging.current = true)}
            onChange={(e) => engine.seek(Number(e.target.value))}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
          />
        </div>
        {extra && <div className="room-tp-extra">{extra}</div>}
      </div>
    </div>
  );
}
