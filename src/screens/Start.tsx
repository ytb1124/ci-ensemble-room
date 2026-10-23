import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SoundOnButton } from '../components/SoundGate';
import { Icon } from '../components/ui/Icon';
import { useEngineState } from '../audio/useEngine';
import { useProfile } from '../store/profile';
import './calibrate/calibrate.css';

export default function Start() {
  const st = useEngineState();
  const profile = useProfile();
  const nav = useNavigate();
  const [skipAsk, setSkipAsk] = useState(false);

  return (
    <main className="page page-narrow stack-lg">
      <header className="stack" style={{ paddingTop: 16 }}>
        <h1 style={{ fontSize: 40, letterSpacing: -0.5, margin: 0 }}>인공와우 합주실</h1>
        <p className="lead" style={{ margin: 0 }}>
          정답을 맞히는 곳이 아니라, 나에게 잘 들리는 소리를 찾아보는 곳이에요.
        </p>
      </header>

      <section className="card card-tone peach stack-lg" aria-labelledby="start-h">
        <h2 id="start-h" style={{ margin: 0 }}>{st.unlocked ? (profile.calibrated ? '다시 오셨네요' : '먼저 소리를 맞춰요') : '소리부터 켜 볼까요?'}</h2>
        <p style={{ margin: 0 }}>시험이 아니에요. 언제든 멈추고, 나중에 이어 할 수 있어요.</p>

        {!st.unlocked && <SoundOnButton />}

        {st.unlocked && !profile.calibrated && (
          <div className="stack">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => nav('/calibrate')}>
              소리 맞추기 시작 (3–5분) <Icon name="chevronRight" />
            </button>
            {!skipAsk ? (
              <button type="button" className="btn btn-block" onClick={() => setSkipAsk(true)}>
                건너뛰고 합주실로
              </button>
            ) : (
              <div className="stack" role="status">
                <p style={{ margin: 0 }}>나중에 설정에서 맞출 수 있어요.</p>
                <button type="button" className="btn btn-block" onClick={() => nav('/room/hbd')}>
                  합주실로 가기 <Icon name="chevronRight" />
                </button>
              </div>
            )}
          </div>
        )}

        {st.unlocked && profile.calibrated && (
          <div className="stack">
            <div className="cal-start-grid cal-3">
              <button type="button" className="btn btn-primary btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/room/hbd')}>
                지난 설정 그대로
                <span className="small" style={{ fontWeight: 500 }}>바로 합주실로</span>
              </button>
              <button type="button" className="btn btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/calibrate/2?only=1&next=/room/hbd')}>
                크기만 다시
                <span className="small" style={{ fontWeight: 500 }}>② 10초</span>
              </button>
              <button type="button" className="btn btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/calibrate')}>
                처음부터
                <span className="small" style={{ fontWeight: 500 }}>①–⑥</span>
              </button>
            </div>
            <p className="small" style={{ margin: 0 }}>기기나 듣는 방법이 바뀌었다면 처음부터를 권해요.</p>
          </div>
        )}
      </section>

      <p className="small muted" style={{ margin: 0 }}>
        지금은 시험판이라 악기 소리 대신 '쉬—' 하는 잡음이 나요.
      </p>

      <section className="stack" aria-labelledby="flow-h">
        <h2 id="flow-h" style={{ margin: 0, fontSize: 22 }}>이렇게 진행해요</h2>
        <ol className="cal-flow">
          <li>1. 보정</li>
          <li>2. 합주실</li>
          <li>3. 잠깐 질문</li>
          <li>4. 나의 청취 단서</li>
        </ol>
        <p style={{ margin: 0 }}>모두 해서 약 15–20분이에요. 어디서든 멈추고 이어 할 수 있어요.</p>
        <p style={{ margin: 0 }}><Link to="/about" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, textDecoration: 'underline' }}>이 앱에 대해 더 알아보기</Link></p>
      </section>
    </main>
  );
}
