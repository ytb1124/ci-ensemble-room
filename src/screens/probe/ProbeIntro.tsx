import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { getProbeClip, type ClipId } from '../../audio/probeAudio';
import { Icon } from '../../components/ui/Icon';
import './probe.css';

const ORDER: ClipId[] = ['orig', 'attack', 'bright', 'contour', 'rhythm'];

export default function ProbeIntro({ onDone }: { onDone: () => void }) {
  const [pos, setPos] = useState<number | null>(null); // 지금 몇 번째(0~4), null = 재생 안 함
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current++;
      engine.stopClip();
    },
    [],
  );

  const start = async () => {
    const my = ++run.current;
    const ctx = engine.ctx;
    if (!ctx) return;
    setFinished(false);
    setBusy(true);
    try {
      const bufs = await Promise.all(ORDER.map((id) => getProbeClip(ctx, id)));
      if (run.current !== my) return;
      setBusy(false);
      const playAt = (i: number) => {
        if (run.current !== my) return;
        if (i >= ORDER.length) {
          setPos(null);
          setFinished(true);
          return;
        }
        setPos(i);
        engine.playClip(bufs[i], `intro-${i}`, { onEnded: () => playAt(i + 1) });
      };
      playAt(0);
    } catch {
      setBusy(false);
    }
  };

  const playing = pos !== null;
  return (
    <main className="page page-narrow probe-page">
      <div className="stack-lg">
        <h1 style={{ margin: 0, fontSize: 24 }}>먼저 소리를 들어 볼게요</h1>
        <p className="lead" style={{ margin: 0 }}>어떤 소리들이 나오는지 먼저 들어 보세요. 소리 5개를 한 번씩 이어서 들려 드려요. 약 30초 걸려요.</p>
        <div className="card stack" aria-live="polite">
          {busy && <p style={{ margin: 0 }}>소리를 준비하고 있어요…</p>}
          {playing && (
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              <Icon name="speaker" /> 소리 {pos + 1}/{ORDER.length}
            </p>
          )}
          {!busy && !playing && !finished && <p style={{ margin: 0 }}>준비되면 눌러 주세요.</p>}
          {finished && <p style={{ margin: 0 }}>모두 들었어요. 다시 들어도 되고, 바로 시작해도 돼요.</p>}
          <div className="probe-actions">
            {!playing && (
              <button type="button" className="btn btn-lg" disabled={busy} onClick={start}>
                <Icon name="play" /> {finished ? '다시 듣기' : '이어서 듣기'}
              </button>
            )}
            {playing && (
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => {
                  run.current++;
                  engine.stopClip();
                  setPos(null);
                }}
              >
                멈추기
              </button>
            )}
          </div>
        </div>
        <div className="probe-actions">
          <button type="button" className={`btn btn-lg ${finished ? 'btn-primary' : ''}`} onClick={onDone}>
            {finished ? '질문 시작하기' : '건너뛰기'}
          </button>
        </div>
      </div>
    </main>
  );
}
