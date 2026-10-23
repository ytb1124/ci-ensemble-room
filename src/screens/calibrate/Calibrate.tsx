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
import './calibrate.css';

const TITLES = ['나의 듣기 환경', '편안한 크기', '좌우', '소리 색', '악기 섞기', '저음 도움 (선택)'];
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
      engine.setSection({ id: 'calib', label: '보정', start: beatToSec(song, a), end: beatToSec(song, b) }, true);
    } else if (step === 6) {
      const [a, b] = song.bassLoopBeats;
      engine.setSection({ id: 'bassloop', label: '베이스', start: beatToSec(song, a), end: beatToSec(song, b) }, true);
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
      <h1 className="cal-step-title" style={{ fontSize: 28 }}>소리 맞추기</h1>
      {!only && (
        <Steps
          total={6}
          current={step <= 6 ? step : 0}
          done={profile.calibStepsDone.filter((n) => n >= 1 && n <= 6)}
          labels={TITLES}
        />
      )}
      <p className="muted" style={{ margin: 0 }}>시험이 아니에요. 지금 내게 편한 소리를 고르는 거예요.</p>
    </div>
  );

  if (loadErr || st.error) {
    return (
      <main className="page page-narrow stack-lg">
        {header}
        <p role="alert" style={{ color: 'var(--error)', fontWeight: 600 }}>소리를 불러오지 못했어요. 새로고침해 주세요.</p>
      </main>
    );
  }

  if (step === SUMMARY) {
    const lines: { n: number; label: string; value: string }[] = [
      { n: 1, label: '듣기 환경', value: `${profile.config ? CONFIG_LABEL[profile.config] : '아직 안 골랐어요'} · ${profile.route ? ROUTE_LABEL[profile.route].split(' (')[0] : '경로 안 골랐어요'}${profile.maker ? ` · ${MAKER_LABEL[profile.maker]}` : ''}` },
      { n: 2, label: '편안한 크기', value: `앱 음량 ${sign(profile.masterGainDb)}` },
      { n: 3, label: '좌우', value: profile.stereo ? `${profile.balance === -1 ? '왼쪽' : profile.balance === 1 ? '오른쪽' : '가운데'}${profile.spread ? ' · 넓게 펼침' : ''}` : '양쪽 같은 소리(모노)' },
      { n: 4, label: '소리 색', value: `저음 ${profile.eqLowDb ? sign(profile.eqLowDb) : '원래 소리'} · 또렷함 ${profile.eqMidDb ? `${sign(profile.eqMidDb)}${profile.eqMidHz === 3000 ? ' (약 3 kHz)' : ''}` : '원래 소리'}` },
      { n: 5, label: '악기 섞기', value: INSTRUMENTS.map((i) => `${INSTRUMENT_SHORT[i]} ${sign(profile.instGainDb[i], '')}`.trim()).join(' · ') },
      { n: 6, label: '저음 도움', value: profile.bassAssist === 'boost' ? '저음 강조' : profile.bassAssist === 'octaveUp' ? '한 옥타브 위 소리 더하기' : profile.bassVizEmphasis ? '원래 소리 (그림에서 저음 박을 더 눈에 띄게)' : '원래 소리' },
    ];
    return (
      <main className="page page-narrow stack-lg">
        {header}
        <section className="card stack-lg" aria-labelledby="cal-sum-h">
          <h2 id="cal-sum-h" style={{ margin: 0 }}>지금 설정으로 합주실에 들어갈까요?</h2>
          <p className="muted" style={{ margin: 0 }}>모두 추천 시작점이에요. 합주실에서도 언제든 바꿀 수 있어요.</p>
          <ul className="cal-sum">
            {lines.map((l) => (
              <li key={l.n}>
                <div>
                  <div className="cal-sum-label">{l.label}</div>
                  <div>{l.value}</div>
                </div>
                <Link className="btn btn-sm" to={`/calibrate/${l.n}?only=1&next=${encodeURIComponent('/calibrate/7')}`} aria-label={`${l.label} 바꾸기`}>
                  바꾸기
                </Link>
              </li>
            ))}
          </ul>
          {(!profile.config || !profile.route) && (
            <p className="cal-note" role="status">①에서 듣기 환경을 먼저 골라 주세요.</p>
          )}
          <div className="cal-nav">
            <button type="button" className="btn" onClick={() => goto(6)}><Icon name="chevronLeft" /> 이전</button>
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
                합주실로 들어가기 <Icon name="chevronRight" />
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
          {step}단계. {TITLES[step - 1]}
        </h2>
        {st.loading || !ready ? <p role="status">소리를 준비하는 중이에요…</p> : body}
        <div className="cal-nav">
          {!only && step > 1 ? (
            <button type="button" className="btn" onClick={() => goto(step - 1)}>
              <Icon name="chevronLeft" /> 이전
            </button>
          ) : <span />}
          <div className="cal-nav-right">
            {only ? (
              <button type="button" className="btn btn-primary btn-lg" disabled={needsRequired} onClick={saveAndBack}>
                <Icon name="check" /> 저장하고 돌아가기
              </button>
            ) : (
              <>
                {step >= 3 && (
                  <button type="button" className="btn" onClick={skipStep}>건너뛰기 (원래 소리 유지)</button>
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
                  다음 <Icon name="chevronRight" />
                </button>
              </>
            )}
          </div>
        </div>
        {!only && step <= 2 && <p className="small muted" style={{ margin: 0 }}>①과 ②는 꼭 필요해요. 나머지는 건너뛰어도 괜찮아요.</p>}
      </section>
    </main>
  );
}
