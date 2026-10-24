// 화면-소리 맞추기(구성안 7.4의 3번). 30초 카드, 모달 아님.
import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useAnimationFrame } from '../../audio/useEngine';
import { updateProfile, useProfile } from '../../store/profile';
import { DbSlider } from '../ui/controls';
import { Icon } from '../ui/Icon';
import './viz.css';

export function SyncCard({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const initial = useRef(profile.sync);
  const [val, setVal] = useState(profile.sync.userOffsetMs);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const lastOn = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(!!engine.ctx);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const f = () => setReduced(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);

  useEffect(() => {
    if (engine.ctx) {
      engine.startSyncClicks(0.6);
      setReady(true);
    }
    return () => engine.stopSyncClicks();
  }, []);

  useAnimationFrame(() => {
    const ph = engine.syncPhase();
    const on = ph !== null && ph < 0.08;
    if (on !== lastOn.current) {
      lastOn.current = on;
      dot.current?.classList.toggle('is-on', on);
      if (label.current) label.current.textContent = on ? '지금' : '';
    }
  }, true);

  const change = useCallback((v: number) => {
    setVal(v);
    updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: v, method: 'tap', calibratedAt: new Date().toISOString() } }));
  }, []);

  const close = (fn?: () => void) => {
    engine.stopSyncClicks();
    fn?.();
    onClose();
  };
  const save = () =>
    close(() => updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: val, method: 'tap', calibratedAt: new Date().toISOString() } })));
  const unsure = () => close(() => updateProfile((p) => ({ sync: { ...p.sync, userOffsetMs: 0, method: 'auto', calibratedAt: null } })));
  const cancel = () => close(() => updateProfile({ sync: initial.current }));

  const out = engine.latencyInfo().outputLatency;
  const btHint = profile.route === 'direct' && (out === null || out < 0.05);

  return (
    <div className="card viz-sync" role="group" aria-label="화면과 소리 맞추기">
      <div>
        <h3 style={{ margin: 0, letterSpacing: 0 }}>화면과 소리 맞추기</h3>
        <p style={{ margin: '4px 0 0' }}>동그라미가 깜빡이는 순간과 소리가 딱 맞을 때까지 막대를 움직여 주세요.</p>
      </div>
      {!ready && <p className="muted" role="status">먼저 소리를 켜 주세요.</p>}
      <div className="viz-sync-stage" aria-hidden="true">
        <div ref={dot} className={`viz-sync-dot${reduced ? ' is-square' : ''}`}>
          <span ref={label} />
        </div>
      </div>
      <DbSlider
        label="그림 늦추기"
        value={val}
        min={-300}
        max={300}
        step={10}
        unit="ms"
        onChange={change}
        formatValue={(v) => (v > 0 ? `+${v} ms (그림을 늦춤)` : v < 0 ? `${v} ms (그림을 당김)` : '0 ms')}
      />
      {btHint && <p className="viz-note" role="note">블루투스로 들으면 소리가 늦게 도착할 수 있어요.</p>}
      <div className="viz-sync-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={save}>
          <Icon name="check" />
          이대로 좋아요
        </button>
        <button type="button" className="btn btn-lg" onClick={unsure}>
          잘 모르겠어요
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={cancel}>
          닫기
        </button>
      </div>
    </div>
  );
}
