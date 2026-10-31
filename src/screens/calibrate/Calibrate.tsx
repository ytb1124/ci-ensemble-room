import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { engine, useEngineState } from '../../audio/useEngine';
import { SONGS, beatToSec } from '../../config/songs';
import { Steps } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { commitCalibration, gainRange, markCalibStep, updateProfile, useProfile } from '../../store/profile';
import { INSTRUMENTS, INSTRUMENT_SHORT, type BassAssist, type Profile } from '../../types';
import {
  CONFIG_LABEL, MAKER_LABEL, ROUTE_LABEL, isBalanceMode,
  Step1, Step2, Step3, Step4, Step5, Step6, type Draft,
} from './steps';
import { ko, tx } from '../../i18n';
import './calibrate.css';

const titles = () => [
  tx('듣기 환경', 'Your setup'),
  tx('편안한 크기', 'Comfortable volume'),
  tx('좌우', 'Left/right'),
  tx('소리 색', 'Tone'),
  tx('악기 섞기', 'Instrument mix'),
  tx('저음 도움 (선택)', 'Bass help (optional)'),
];
const SUMMARY = 7;

const pickDraft = (p: Profile): Draft => ({
  config: p.config, route: p.route, maker: p.maker, masterGainDb: p.masterGainDb,
  stereo: p.stereo, balance: p.balance, spread: p.spread,
  eqLowDb: p.eqLowDb, eqMidDb: p.eqMidDb, eqMidHz: p.eqMidHz,
  instGainDb: { ...p.instGainDb }, bassAssist: p.bassAssist, bassVizEmphasis: p.bassVizEmphasis,
});

const sign = (n: number, unit = 'dB') => `${n > 0 ? '+' : ''}${n} ${unit}`;

export default function Calibrate() {
  const profile = useProfile();
  const st = useEngineState();
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();
  const only = sp.get('only') === '1';
  const next = sp.get('next');

  // 시작 단계: 주소의 단계 > (재방문이면 1) > 첫 미완료 단계
  const initial = useRef<number>(0);
  if (!initial.current) {
    const n = Number(params.step);
    if (n >= 1 && n <= SUMMARY) initial.current = n;
    else if (profile.calibrated) initial.current = 1;
    else {
      const first = [1, 2, 3, 4, 5, 6].find((s) => !profile.calibStepsDone.includes(s));
      initial.current = first ?? SUMMARY;
    }
  }
  const stepNum = Number(params.step);
  const step = stepNum >= 1 && stepNum <= SUMMARY ? stepNum : initial.current;

  const [d, setD] = useState<Draft>(() => pickDraft(profile));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const [hzTest, setHzTest] = useState(false);
  const [bassPick, setBassPick] = useState<BassAssist | 'unsure' | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  // 곡 불러오기
  useEffect(() => {
    let alive = true;
    engine.loadSong('hbd').catch(() => alive && setLoadErr(true));
    return () => { alive = false; };
  }, []);
  // 화면을 떠날 때 정리
  useEffect(() => () => {
    engine.setPreview(null);
    engine.pause();
    engine.setSection(null, false);
    engine.allOn();
  }, []);

  const ready = st.songId === 'hbd' && !st.loading;
  const bd = isBalanceMode(d);

  // 미리 듣기 값: 지금까지 고른 값 전체(저장 전)
  const preview = useMemo<Partial<Profile>>(
    () => ({
      masterGainDb: d.masterGainDb,
      stereo: bd, balance: bd ? d.balance : 0, spread: bd ? d.spread : false,
      eqLowDb: d.eqLowDb,
      eqMidDb: hzTest && d.eqMidDb === 0 ? 3 : d.eqMidDb,
      eqMidHz: d.eqMidHz,
      instGainDb: d.instGainDb,
      bassAssist: d.bassAssist,
    }),
    [d, bd, hzTest],
  );
  useEffect(() => {
    if (ready) engine.setPreview(preview);
  }, [preview, ready]);

  // 단계가 바뀔 때 구간·솔로 준비
  useEffect(() => {
    if (!ready) return;
    const song = SONGS.hbd;
    engine.pause();
    if (step >= 2 && step <= 5) {
      const [a, b] = song.calibLoopBeats;
      engine.setSection({ id: 'calib', label: tx('소리 맞추기', 'Sound setup'), start: beatToSec(song, a), end: beatToSec(song, b) }, true);
    } else if (step === 6) {
      const [a, b] = song.bassLoopBeats;
      engine.setSection({ id: 'bassloop', label: tx('베이스', 'Bass'), start: beatToSec(song, a), end: beatToSec(song, b) }, true);
      engine.solo('bass');
    } else {
      engine.setSection(null, false);
    }
    return () => {
      engine.pause();
      engine.allOn();
    };
  }, [step, ready]);

  const goto = (n: number) => nav(`/calibrate/${n}${sp.toString() ? `?${sp.toString()}` : ''}`);

  const commitStep = (n: number) => {
    switch (n) {
      case 1:
        commitCalibration({
          config: d.config, route: d.route, maker: d.maker,
          ...(bd ? {} : { stereo: false, balance: 0 as const, spread: false }),
        });
        break;
      case 2: commitCalibration({ masterGainDb: d.masterGainDb }); break;
      case 3: commitCalibration({ stereo: bd, balance: bd ? d.balance : 0, spread: bd ? d.spread : false }); break;
      case 4: commitCalibration({ eqLowDb: d.eqLowDb, eqMidDb: d.eqMidDb, eqMidHz: d.eqMidHz }); break;
      case 5: commitCalibration({ instGainDb: d.instGainDb }); break;
      case 6: commitCalibration({ bassAssist: d.bassAssist, bassVizEmphasis: d.bassVizEmphasis }); break;
    }
    markCalibStep(n);
  };

  const skipStep = () => {
    markCalibStep(step);
    setD(pickDraft(profile)); // 건너뛰면 원래 소리 유지
    setHzTest(false);
    setBassPick(null);
    goto(step + 1);
  };
  const saveAndBack = () => {
    commitStep(step);
    if (next) nav(next);
    else nav(-1);
  };
  const needsRequired = step === 1 && (!d.config || !d.route);

  const header = (
    <div className="cal-head">
      <h1 className="cal-step-title" style={{ fontSize: 28 }}>{tx('소리 맞추기', 'Sound setup')}</h1>
      {!only && (
        <Steps
          total={6}
          current={step <= 6 ? step : 0}
          done={profile.calibStepsDone.filter((n) => n >= 1 && n <= 6)}
          labels={titles()}
        />
      )}
      <p className="muted" style={{ margin: 0 }}>{tx('시험이 아니에요. 지금 나에게 편한 소리를 고르면 돼요.', 'This is not a test. Just pick the sound that feels comfortable for you now.')}</p>
    </div>
  );

  if (loadErr || st.error) {
    return (
      <main className="page page-narrow stack-lg">
        {header}
        <p role="alert" style={{ color: 'var(--error)', fontWeight: 600 }}>{tx('소리를 불러오지 못했어요. 페이지를 새로고침해 주세요.', 'The sound could not load. Please refresh the page.')}</p>
      </main>
    );
  }

  if (step === SUMMARY) {
    const lines: { n: number; label: string; value: string }[] = [
      { n: 1, label: tx('듣기 환경', 'Your setup'), value: `${profile.config ? CONFIG_LABEL[profile.config] : tx('아직 안 골랐어요', 'Not picked yet')} · ${profile.route ? ROUTE_LABEL[profile.route].split(' (')[0] : tx('듣는 방법 안 골랐어요', 'How you listen not picked')}${profile.maker ? ` · ${MAKER_LABEL[profile.maker]}` : ''}` },
      { n: 2, label: tx('편안한 크기', 'Comfortable volume'), value: `${tx('앱 음량', 'App volume')} ${sign(profile.masterGainDb)}` },
      { n: 3, label: tx('좌우', 'Left/right'), value: profile.stereo ? `${profile.balance === -1 ? tx('왼쪽', 'Left') : profile.balance === 1 ? tx('오른쪽', 'Right') : tx('가운데', 'Center')}${profile.spread ? tx(' · 넓게 펼침', ' · Wide stereo') : ''}` : tx('양쪽 같은 소리(모노)', 'Same sound on both sides (mono)') },
      { n: 4, label: tx('소리 색', 'Tone'), value: `${tx('저음', 'Bass')} ${profile.eqLowDb ? sign(profile.eqLowDb) : tx('원래 소리', 'Original sound')} · ${tx('또렷함', 'Clarity')} ${profile.eqMidDb ? `${sign(profile.eqMidDb)}${profile.eqMidHz === 3000 ? tx(' (약 3 kHz)', ' (about 3 kHz)') : ''}` : tx('원래 소리', 'Original sound')}` },
      { n: 5, label: tx('악기 섞기', 'Instrument mix'), value: INSTRUMENTS.map((i) => `${INSTRUMENT_SHORT[i]} ${sign(profile.instGainDb[i], '')}`.trim()).join(' · ') },
      { n: 6, label: tx('저음 도움', 'Bass help'), value: profile.bassAssist === 'boost' ? tx('저음 키우기', 'Boost bass') : profile.bassAssist === 'octaveUp' ? tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up') : profile.bassVizEmphasis ? tx('원래 소리 (그림에서 베이스 박자를 더 눈에 띄게)', 'Original sound (bass beat easier to see in the picture)') : tx('원래 소리', 'Original sound') },
    ];
    return (
      <main className="page page-narrow stack-lg">
        {header}
        <section className="card stack-lg" aria-labelledby="cal-sum-h">
          <h2 id="cal-sum-h" style={{ margin: 0 }}>{tx('지금 설정으로 합주실에 들어갈까요?', 'Go to the Ensemble Room with these settings?')}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx('모두 처음 권하는 값이에요. 합주실에서도 언제든 바꿀 수 있어요.', 'These are all starting suggestions. You can change them any time in the room.')}</p>
          <ul className="cal-sum">
            {lines.map((l) => (
              <li key={l.n}>
                <div>
                  <div className="cal-sum-label">{l.label}</div>
                  <div>{l.value}</div>
                </div>
                <Link className="btn btn-sm" to={`/calibrate/${l.n}?only=1&next=${encodeURIComponent('/calibrate/7')}`} aria-label={tx(ko`${l.label} 바꾸기`, `Change ${l.label}`)}>
                  {tx('바꾸기', 'Change')}
                </Link>
              </li>
            ))}
          </ul>
          {(!profile.config || !profile.route) && (
            <p className="cal-note" role="status">{tx('①에서 듣기 환경을 먼저 골라 주세요.', 'Please choose your setup in step 1 first.')}</p>
          )}
          <div className="cal-nav">
            <button type="button" className="btn" onClick={() => goto(6)}><Icon name="chevronLeft" /> {tx('이전', 'Back')}</button>
            <div className="cal-nav-right">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={!profile.config || !profile.route}
                onClick={() => {
                  updateProfile({ calibrated: true });
                  nav('/room/hbd');
                }}
              >
                {tx('합주실로 들어가기', 'Go to the Ensemble Room')} <Icon name="chevronRight" />
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const body = (() => {
    switch (step) {
      case 1: return <Step1 d={d} set={set} />;
      case 2: return <Step2 d={d} set={set} onCommit={(v) => commitCalibration({ masterGainDb: v })} />;
      case 3: return <Step3 d={d} set={set} />;
      case 4: return <Step4 d={d} set={set} onHzTest={() => setHzTest(true)} />;
      case 5: return <Step5 d={d} set={set} range={gainRange(profile)} />;
      default: return <Step6 d={d} set={set} pick={bassPick} setPick={setBassPick} />;
    }
  })();

  return (
    <main className="page page-narrow stack-lg">
      {header}
      <section className="card stack-lg" aria-labelledby="cal-h">
        <h2 id="cal-h" style={{ margin: 0 }}>
          {tx(ko`${step}단계.`, `Step ${step}.`)} {titles()[step - 1]}
        </h2>
        {st.loading || !ready ? <p role="status">{tx('소리를 준비하는 중이에요…', 'Getting the sound ready…')}</p> : body}
        <div className="cal-nav">
          {!only && step > 1 ? (
            <button type="button" className="btn" onClick={() => goto(step - 1)}>
              <Icon name="chevronLeft" /> {tx('이전', 'Back')}
            </button>
          ) : <span />}
          <div className="cal-nav-right">
            {only ? (
              <button type="button" className="btn btn-primary btn-lg" disabled={needsRequired} onClick={saveAndBack}>
                <Icon name="check" /> {tx('저장하고 돌아가기', 'Save and go back')}
              </button>
            ) : (
              <>
                {step >= 3 && (
                  <button type="button" className="btn" onClick={skipStep}>{tx('건너뛰기 (원래 소리 유지)', 'Skip (keep original sound)')}</button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={needsRequired}
                  onClick={() => {
                    commitStep(step);
                    goto(step + 1);
                  }}
                >
                  {tx('다음', 'Next')} <Icon name="chevronRight" />
                </button>
              </>
            )}
          </div>
        </div>
        {!only && step <= 2 && <p className="small muted" style={{ margin: 0 }}>{tx('①과 ②는 꼭 해 주세요. 나머지는 건너뛰어도 괜찮아요.', 'Please do steps 1 and 2. You can skip the rest.')}</p>}
      </section>
    </main>
  );
}
