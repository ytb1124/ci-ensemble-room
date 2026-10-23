// 소리 켜기 관문. AudioContext는 사용자 탭 안에서만 만들 수 있으므로(구성안 7.5절 (1))
// 소리가 필요한 화면은 이 컴포넌트로 감싼다. 이미 켜져 있으면 children을 그대로 보여 준다.
import { useState, type ReactNode } from 'react';
import { engine, useEngineState } from '../audio/useEngine';
import { Icon } from './ui/Icon';

export function SoundOnButton({ onDone, label = '소리 켜기' }: { onDone?: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        style={{ minWidth: 220, minHeight: 64, fontSize: 20 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await engine.unlock();
          setBusy(false);
          setFailed(!ok);
          if (ok) onDone?.();
        }}
      >
        <Icon name="speaker" size={26} />
        {busy ? '켜는 중…' : label}
      </button>
      <p className="small muted" style={{ textAlign: 'center' }}>
        아이폰은 옆면 무음 스위치를 꺼 주세요.
      </p>
      {failed && (
        <p role="alert" style={{ color: 'var(--error)', fontWeight: 600 }}>
          소리를 켜지 못했어요. 한 번 더 눌러 주세요.
        </p>
      )}
    </div>
  );
}

export function SoundGate({ children }: { children: ReactNode }) {
  const st = useEngineState();
  if (st.unlocked) return <>{children}</>;
  return (
    <main className="page page-narrow">
      <div className="card stack-lg" style={{ alignItems: 'center', textAlign: 'center', marginTop: 32 }}>
        <h2>먼저 소리를 켜 주세요</h2>
        <p>브라우저는 버튼을 눌러야 소리를 낼 수 있어요.</p>
        <SoundOnButton />
      </div>
    </main>
  );
}

/** 화면이 다시 보였는데 오디오가 멈춰 있으면 띄우는 재개 버튼(7.5절 (1)) */
export function ResumeBanner() {
  const st = useEngineState();
  if (!st.unlocked || st.ctxState === 'running' || st.ctxState === 'none') return null;
  return (
    <div className="resume-banner" role="status">
      <span>소리가 멈췄어요.</span>
      <button type="button" className="btn btn-sm" style={{ background: '#fffaf0', color: '#0a0a0a' }} onClick={() => void engine.unlock()}>
        <Icon name="speaker" size={18} /> 다시 켜기
      </button>
    </div>
  );
}
