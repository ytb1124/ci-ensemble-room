import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SoundOnButton } from '../components/SoundGate';
import { Icon } from '../components/ui/Icon';
import { useEngineState } from '../audio/useEngine';
import { useProfile } from '../store/profile';
import { researchEnabled, useResearch } from '../store/research';
import { tx } from '../i18n';
import './calibrate/calibrate.css';

export default function Start() {
  const st = useEngineState();
  const profile = useProfile();
  const nav = useNavigate();
  const [skipAsk, setSkipAsk] = useState(false);
  const rs = useResearch();

  return (
    <main className="page page-narrow stack-lg">
      <header className="stack" style={{ paddingTop: 16 }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>{tx('인공와우 합주실', 'CI Ensemble Room')}</h1>
        <p className="lead" style={{ margin: 0 }}>
          {tx(
            '정답을 맞히는 곳이 아니라, 나에게 잘 들리는 소리를 찾아보는 곳이에요.',
            "This isn't about getting answers right. It's a place to find the sounds you hear best.",
          )}
        </p>
      </header>

      <section className="card card-tone peach stack-lg" aria-labelledby="start-h">
        <h2 id="start-h" style={{ margin: 0 }}>
          {st.unlocked
            ? profile.calibrated
              ? tx('다시 오셨네요', 'Welcome back')
              : tx('먼저 소리부터 맞춰요', 'First, let’s set up the sound')
            : tx('소리부터 켜 볼까요?', 'Shall we turn on the sound first?')}
        </h2>
        <p style={{ margin: 0 }}>
          {tx(
            '시험이 아니에요. 언제든 멈추고 나중에 이어서 할 수 있어요.',
            'This is not a test. You can stop at any time and continue later.',
          )}
        </p>

        {!st.unlocked && <SoundOnButton />}

        {st.unlocked && !profile.calibrated && (
          <div className="stack">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => nav('/calibrate')}>
              {tx('소리 맞추기 (3–5분)', 'Sound setup (3–5 min)')} <Icon name="chevronRight" />
            </button>
            {!skipAsk ? (
              <button type="button" className="btn btn-block" onClick={() => setSkipAsk(true)}>
                {tx('건너뛰고 합주실로', 'Skip to the Ensemble Room')}
              </button>
            ) : (
              <div className="stack" role="status">
                <p style={{ margin: 0 }}>
                  {tx('소리 맞추기는 나중에 설정에서 할 수 있어요.', 'You can do sound setup later in Settings.')}
                </p>
                <button type="button" className="btn btn-block" onClick={() => nav('/room/hbd')}>
                  {tx('합주실로 가기', 'Go to the Ensemble Room')} <Icon name="chevronRight" />
                </button>
              </div>
            )}
          </div>
        )}

        {st.unlocked && profile.calibrated && (
          <div className="stack">
            <div className="cal-start-grid cal-3">
              <button type="button" className="btn btn-primary btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/room/hbd')}>
                {tx('지난 설정 그대로', 'Keep last settings')}
                <span className="small" style={{ fontWeight: 500 }}>{tx('바로 합주실로', 'Go straight to the room')}</span>
              </button>
              <button type="button" className="btn btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/calibrate/2?only=1&next=/room/hbd')}>
                {tx('크기만 다시 맞추기', 'Reset volume only')}
                <span className="small" style={{ fontWeight: 500 }}>{tx('10초면 끝나요', 'Takes 10 seconds')}</span>
              </button>
              <button type="button" className="btn btn-lg" style={{ flexDirection: 'column', minHeight: 84 }} onClick={() => nav('/calibrate')}>
                {tx('처음부터 다시', 'Start over')}
                <span className="small" style={{ fontWeight: 500 }}>{tx('3–5분', '3–5 min')}</span>
              </button>
            </div>
            <p className="small" style={{ margin: 0 }}>
              {tx(
                '기기나 듣는 방법이 바뀌었다면 처음부터 다시 맞춰 보세요.',
                'If your device or how you listen has changed, start over.',
              )}
            </p>
          </div>
        )}
      </section>

      {researchEnabled && rs.status === 'unknown' && (
        <section className="card card-tone lavender stack" aria-labelledby="start-research">
          <h2 id="start-research" style={{ margin: 0 }}>{tx('연구에 함께해 주실래요? (1분)', 'Would you like to join our study? (1 min)')}</h2>
          <p style={{ margin: 0 }}>
            {tx(
              '인공와우로 음악을 듣는 사람마다 무엇이 잘 들리는지 알아보고 있어요. 이름이나 연락처는 받지 않아요.',
              'We are learning what each person hears well when listening to music with a cochlear implant. We do not ask for your name or contact details.',
            )}
          </p>
          <div className="row">
            <Link to="/join" className="btn btn-primary">
              {tx('자세히 보고 참여하기', 'Learn more and join')} <Icon name="chevronRight" />
            </Link>
          </div>
        </section>
      )}

      <p className="small muted" style={{ margin: 0 }}>
        {tx(
          "지금은 시험판이라 악기 소리 대신 '쉬—' 하는 잡음이 나요.",
          'This is a test version, so you will hear a "shhh" noise instead of instrument sounds.',
        )}
      </p>

      <section className="stack" aria-labelledby="flow-h">
        <h2 id="flow-h" style={{ margin: 0, fontSize: 22 }}>{tx('이렇게 진행해요', 'How it works')}</h2>
        <ol className="cal-flow">
          <li>{tx('1. 소리 맞추기', '1. Sound setup')}</li>
          <li>{tx('2. 합주실', '2. Ensemble Room')}</li>
          <li>{tx('3. 잠깐 질문', '3. Quick questions')}</li>
          <li>{tx('4. 나의 청취 단서', '4. My Listening Cues')}</li>
        </ol>
        <p style={{ margin: 0 }}>{tx('모두 해서 15–20분쯤 걸려요.', 'It takes about 15–20 minutes in total.')}</p>
        <p style={{ margin: 0 }}><Link to="/about" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, textDecoration: 'underline' }}>{tx('이 앱에 대해 더 알아보기', 'Learn more about this app')}</Link></p>
      </section>
    </main>
  );
}
