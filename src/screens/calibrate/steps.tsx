// 보정 단계별 화면(구성안 4.1). 값은 상위(Calibrate)의 draft로 들고, 소리는 engine.setPreview로 미리 듣는다.
import { useState, type ReactNode } from 'react';
import type { BassAssist, DeviceConfig, InstrumentId, Maker, Profile, Route } from '../../types';
import { INSTRUMENTS, INSTRUMENT_LABEL } from '../../types';
import { engine, useEngineState } from '../../audio/useEngine';
import { ABChoice, DbSlider } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { InstrumentFigure } from '../../components/instruments/InstrumentCard';
import { ko, tx } from '../../i18n';
import { dbToLevel, loudnessScale, loudnessWord, loudnessZone } from '../../config/loudness';

export type Draft = Pick<
  Profile,
  | 'config' | 'route' | 'maker' | 'masterGainDb' | 'stereo' | 'balance' | 'spread'
  | 'eqLowDb' | 'eqMidDb' | 'eqMidHz' | 'instGainDb' | 'bassAssist' | 'bassVizEmphasis'
>;
export interface StepProps {
  d: Draft;
  set: (patch: Partial<Draft>) => void;
}

export const CONFIG_LABEL: Record<DeviceConfig, string> = {
  get bilateral() { return tx('양쪽 인공와우', 'CIs in both ears'); },
  get unilateral() { return tx('한쪽 인공와우', 'CI in one ear'); },
  get bimodal() { return tx('인공와우 + 반대쪽 보청기', 'CI + hearing aid in the other ear'); },
  get ssd() { return tx('인공와우 + 반대쪽은 잘 들림', 'CI + typical hearing in the other ear'); },
  get unknown() { return tx('잘 모르겠어요', 'Not sure'); },
};
export const ROUTE_LABEL: Record<Route, string> = {
  get direct() { return tx('프로세서에 직접 연결 (블루투스·스트리머·선)', 'Streamed to your processor (Bluetooth, streamer or cable)'); },
  get speaker() { return tx('스피커', 'Speakers'); },
  get headphones() { return tx('이어폰·헤드폰', 'Earphones or headphones'); },
};
export const MAKER_LABEL: Record<NonNullable<Maker>, string> = {
  get cochlear() { return tx('코클리어', 'Cochlear'); },
  get medel() { return tx('메드엘', 'MED-EL'); },
  get ab() { return tx('어드밴스드 바이오닉스', 'Advanced Bionics'); },
  get oticon() { return tx('오티콘', 'Oticon'); },
  get unknown() { return tx('잘 모르겠어요', 'Not sure'); },
};
const ROUTE_REC: Partial<Record<DeviceConfig, Route>> = {
  ssd: 'speaker', bimodal: 'speaker', unilateral: 'direct', bilateral: 'direct',
};
const ROUTE_REC_TEXT: Record<DeviceConfig, string> = {
  get ssd() { return tx('스피커로 양쪽 귀로 함께 듣는 쪽을 더 좋아한 분이 많았어요. 직접 연결과 비교해 봐도 좋아요.', 'Many people like listening through speakers with both ears. You can also compare it with streaming.'); },
  get bimodal() { return tx('스피커로 양쪽 귀로 함께 듣는 쪽을 더 좋아한 분이 많았어요. 직접 연결과 비교해 봐도 좋아요. 보청기도 함께 끼고 들어 보세요.', 'Many people like listening through speakers with both ears. You can also compare it with streaming. Try wearing your hearing aid too.'); },
  get unilateral() { return tx('이런 분들은 직접 연결을 조금 더 좋아하거나, 차이를 크게 느끼지 않았어요.', 'People like you often liked streaming a little more, or did not notice much difference.'); },
  get bilateral() { return tx('이런 분들은 직접 연결을 조금 더 좋아하거나, 차이를 크게 느끼지 않았어요.', 'People like you often liked streaming a little more, or did not notice much difference.'); },
  get unknown() { return tx('지금 듣는 방식 그대로 시작해요.', 'We will start with the way you listen now.'); },
};
export const recRoute = (c: DeviceConfig | null) => (c ? ROUTE_REC[c] ?? null : null);

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="btn cal-choice" aria-pressed={selected} onClick={onClick}>
      {selected && <Icon name="check" size={20} />}
      <span>{children}</span>
    </button>
  );
}

/** 이 단계의 루프 재생/정지 */
export function LoopPlayer({ label }: { label?: string }) {
  const shown = label ?? tx('합주 4마디 반복', 'band, 4 bars on loop');
  const st = useEngineState();
  return (
    <button
      type="button"
      className="btn btn-lg btn-block"
      aria-pressed={st.playing}
      disabled={st.loading || st.songId !== 'hbd'}
      onClick={() => (st.playing ? engine.pause() : engine.play())}
    >
      <Icon name={st.playing ? 'pause' : 'play'} />
      {st.playing ? tx('정지', 'Stop') : `${tx('재생', 'Play')} (${shown})`}
    </button>
  );
}

// ───────── ① 나의 듣기 환경 ─────────
export function Step1({ d, set }: StepProps) {
  const configs: DeviceConfig[] = ['bilateral', 'unilateral', 'bimodal', 'ssd', 'unknown'];
  const routes: Route[] = ['direct', 'speaker', 'headphones'];
  const makers: NonNullable<Maker>[] = ['cochlear', 'medel', 'ab', 'oticon', 'unknown'];
  return (
    <div className="stack-lg">
      <p className="cal-note">{tx('처음 소리를 정하는 데만 써요. 시험이 아니에요.', 'This is only used to set up your first sound. It is not a test.')}</p>
      <MusicProgramNote maker={d.maker} />
      <div className="stack" role="group" aria-labelledby="cal-q-config">
        <h3 className="cal-group-title" id="cal-q-config">{tx('어떻게 듣고 있나요?', 'How do you hear?')}</h3>
        <div className="cal-choices">
          {configs.map((c) => (
            <Choice
              key={c}
              selected={d.config === c}
              onClick={() => set({ config: c, route: recRoute(c) ?? d.route })}
            >
              {CONFIG_LABEL[c]}
            </Choice>
          ))}
        </div>
      </div>
      <div className="stack" role="group" aria-labelledby="cal-q-route">
        <h3 className="cal-group-title" id="cal-q-route">{tx('소리는 어디로 들어가나요?', 'Where does the sound go?')}</h3>
        <div className="cal-choices">
          {routes.map((r) => (
            <Choice key={r} selected={d.route === r} onClick={() => set({ route: r })}>
              {ROUTE_LABEL[r]}
            </Choice>
          ))}
        </div>
        {d.config && (
          <p className="cal-note" aria-live="polite">
            {ROUTE_REC_TEXT[d.config]} {tx('(처음 권하는 방법일 뿐이에요. 바꿔도 돼요.)', '(This is only a starting suggestion. You can change it.)')}
          </p>
        )}
      </div>
      <div className="stack" role="group" aria-labelledby="cal-q-maker">
        <h3 className="cal-group-title" id="cal-q-maker">{tx('인공와우 회사 (선택)', 'CI manufacturer (optional)')}</h3>
        <div className="cal-choices">
          {makers.map((m) => (
            <Choice key={m} selected={d.maker === m} onClick={() => set({ maker: d.maker === m ? null : m })}>
              {MAKER_LABEL[m]}
            </Choice>
          ))}
        </div>
      </div>
      <p className="small muted">
        {tx('프로세서에서 저음·고음을 따로 바꿔 두었다면, 평소 설정 그대로 두고 맞춰 주세요.', 'If you changed bass or treble on your processor, keep your usual settings while you set up.')}
      </p>
    </div>
  );
}

/** 회사별 프로그램 바꾸는 곳(앱·리모컨 이름). 이름만 안내하고 메뉴 경로는 기기마다 달라 적지 않는다 */
const MUSIC_PROGRAM_WHERE: Partial<Record<NonNullable<Maker>, string>> = {
  get cochlear() { return tx('Nucleus Smart 앱이나 리모컨', 'the Nucleus Smart app or remote'); },
  get medel() { return tx('AudioKey 앱이나 리모컨', 'the AudioKey app or remote'); },
  get ab() { return tx('AB Remote 앱이나 프로세서 버튼', 'the AB Remote app or the processor button'); },
  get oticon() { return tx('Oticon Medical Streamer나 앱', 'the Oticon Medical Streamer or app'); },
};

/** 음악 듣기용 프로그램(맵)으로 바꾸라는 안내. 피드백(10/28): 소리 맞추기 첫 단계에서 먼저 알려 준다 */
function MusicProgramNote({ maker }: { maker: Maker | null }) {
  const where = maker ? MUSIC_PROGRAM_WHERE[maker] : undefined;
  return (
    <aside className="card card-tone mint cal-program" aria-labelledby="cal-program-title">
      <span className="cal-program-icon" aria-hidden="true"><Icon name="music" size={28} /></span>
      <div className="stack" style={{ gap: 6 }}>
        <h3 className="cal-group-title" id="cal-program-title" style={{ margin: 0 }}>
          {tx('시작 전에: 프로세서를 ‘음악’ 프로그램으로 바꿔 주세요', 'Before you start: switch your processor to its Music program')}
        </h3>
        <p style={{ margin: 0 }}>
          {where
            ? tx(ko`매핑 때 받은 ‘음악’ 프로그램(맵)이 있으면 ${where}에서 지금 바꿔 주세요.`, `If your audiologist set up a Music program (map), switch to it now using ${where}.`)
            : tx('매핑 때 받은 ‘음악’ 프로그램(맵)이 있으면 리모컨이나 스마트폰 앱에서 지금 바꿔 주세요.', 'If your audiologist set up a Music program (map), switch to it now using your remote or phone app.')}
          {' '}
          {tx('말소리용 프로그램은 잡음을 줄이느라 악기 소리까지 줄일 수 있어요.', 'Programs made for speech may turn down instrument sounds while reducing noise.')}
        </p>
        <p className="small" style={{ margin: 0 }}>
          {tx('음악 프로그램이 없다면 평소 프로그램 그대로 괜찮아요. 다음 매핑 때 청능사에게 음악용 프로그램을 따로 만들어 달라고 해 보세요.', 'No Music program? Your usual program is fine. At your next mapping, you can ask your audiologist for a separate program for music.')}
        </p>
      </div>
    </aside>
  );
}

// ───────── ② 편안한 크기 ─────────
export function Step2({ d, set, onCommit }: StepProps & { onCommit: (v: number) => void }) {
  return (
    <div className="stack-lg">
      <ol className="cal-list">
        <li>{tx('음악이 편안하게 들릴 때까지 휴대폰(또는 프로세서) 음량을 조절해 주세요.', 'Change the volume on your phone (or processor) until the music feels comfortable.')}</li>
        <li>{tx('아래 [앱 음량]으로 조금 더 맞춰도 돼요.', 'You can fine-tune it with [App volume] below.')}</li>
        <li>{tx('다 맞췄으면 기기 음량은 되도록 그대로 두세요.', 'When you are done, try to leave the device volume as it is.')}</li>
      </ol>
      <LoopPlayer />
      <DbSlider
        label={tx('앱 음량', 'App volume')}
        value={d.masterGainDb}
        min={-6}
        max={6}
        step={1}
        onChange={(v) => set({ masterGainDb: v })}
        onCommit={onCommit}
      />
      <LoudnessRating />
    </div>
  );
}

/** 매핑 때 쓰는 0–10 크기 차트로 지금 크기를 골라 보게 한다. 6(가장 편안함) 근처가 목표 */
function LoudnessRating() {
  const [pick, setPick] = useState<number | null>(null);
  const steps = loudnessScale().slice().reverse(); // 차트처럼 위가 10
  const advice =
    pick === null ? null
      : pick <= 4 ? tx('조금 작게 들려요. 음량을 올려서 6(가장 편안함) 근처로 맞춰 보세요.', 'It sounds a bit soft. Turn the volume up to around 6 (Most comfortable).')
      : pick <= 7 ? tx('좋아요. 5–7이면 편안한 크기예요. 6에 가까울수록 오래 들어도 편해요.', 'Good. 5–7 is a comfortable level. Closer to 6 is easier for long listening.')
      : pick === 8 ? tx('조금 커요. 음량을 낮춰서 6 근처로 맞춰 주세요.', 'A bit loud. Turn the volume down to around 6.')
      : tx('너무 커요. 바로 음량을 낮춰 주세요.', 'Too loud. Please turn the volume down now.');
  return (
    <div className="stack card cal-loud" role="group" aria-labelledby="cal-loud-title">
      <div className="stack" style={{ gap: 4 }}>
        <h3 className="cal-group-title" id="cal-loud-title">{tx('지금 소리는 몇 정도인가요?', 'How loud is it right now?')}</h3>
        <p className="small muted" style={{ margin: 0 }}>{tx('매핑 때 보던 0–10 크기 표와 같아요. 6(가장 편안함)이 되도록 맞춰 보세요.', 'This is the same 0–10 loudness chart used at your mapping. Try to reach 6 (Most comfortable).')}</p>
      </div>
      <div className="cal-loud-chart">
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            className={'cal-loud-row is-' + loudnessZone(s.n) + (s.n === 6 ? ' is-target' : '')}
            aria-pressed={pick === s.n}
            onClick={() => setPick(s.n)}
          >
            <span className={'cal-loud-num is-' + loudnessZone(s.n)}>{s.n}</span>
            <span className="cal-loud-word">{s.word}</span>
            {s.n === 6 && <span className="tag">{tx('목표', 'Target')}</span>}
            {pick === s.n && <Icon name="check" size={20} />}
          </button>
        ))}
      </div>
      {advice && <p className="cal-note" role="status" style={{ margin: 0 }}>{advice}</p>}
    </div>
  );
}

// ───────── ③ 좌우 ─────────
export function isBalanceMode(d: Pick<Draft, 'config' | 'route'>) {
  return d.config === 'bilateral' && d.route === 'direct';
}
export function Step3({ d, set }: StepProps) {
  const bd = isBalanceMode(d);
  let text: ReactNode;
  if (bd) text = tx('왼쪽 / 가운데 / 오른쪽 중 어디가 편해요?', 'Which feels best: left, center or right?');
  else if (d.config === 'bimodal')
    text = (<>{tx('양쪽에 같은 소리를 보내요(모노).', 'Both sides get the same sound (mono).')} <strong>{tx('보청기도 함께 끼고 들어 보세요.', 'Try wearing your hearing aid too.')}</strong></>);
  else if (d.config === 'ssd') text = tx('양쪽으로 함께 들어 보세요.', 'Try listening with both ears.');
  else text = tx('양쪽에 같은 소리를 보내요(모노).', 'Both sides get the same sound (mono).');
  const bal: { v: -1 | 0 | 1; l: string }[] = [
    { v: -1, l: tx('왼쪽', 'Left') }, { v: 0, l: tx('가운데', 'Center') }, { v: 1, l: tx('오른쪽', 'Right') },
  ];
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>{text}</p>
      <LoopPlayer />
      {bd && (
        <>
          <div className="cal-choices cal-3" role="group" aria-label={tx('좌우 밸런스', 'Left/right balance')}>
            {bal.map((b) => (
              <Choice key={b.v} selected={d.balance === b.v} onClick={() => set({ balance: b.v })}>
                {b.l}
              </Choice>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-block"
            aria-pressed={d.spread}
            onClick={() => set({ spread: !d.spread })}
          >
            <Icon name={d.spread ? 'on' : 'off'} />
            {tx('넓게 펼쳐 듣기', 'Wide stereo')} {d.spread ? tx('켜짐', 'On') : tx('꺼짐', 'Off')} {tx('(선택)', '(optional)')}
          </button>
          <p className="small muted">{tx('카혼은 왼쪽, 피아노는 조금 왼쪽, 베이스는 가운데, 트럼펫은 오른쪽에서 들려요.', 'Cajon is on the left, piano a little left, bass in the center, and trumpet on the right.')}</p>
        </>
      )}
    </div>
  );
}

// ───────── ④ 소리 색 ─────────
type Two = 'A' | 'B';
function Tone({
  title, field, moreLabel, d, set, children, active, onActivate,
}: {
  title: string;
  /** 지금 듣고 있는 문항(1 = 원래↔더, 2 = 더↔한 단계 더). "소리 나는 중"은 이 문항에만 표시한다 */
  active: 1 | 2 | null;
  onActivate: (sub: 1 | 2) => void;
  field: 'eqLowDb' | 'eqMidDb';
  moreLabel: string;
  d: Draft;
  set: (p: Partial<Draft>) => void;
  children?: ReactNode;
}) {
  const st = useEngineState();
  const [pick, setPick] = useState<Two | 'U' | null>(null);
  const [pick2, setPick2] = useState<Two | null>(null);
  const v = d[field];
  const playing1: Two | null = st.playing && active === 1 ? (v === 0 ? 'A' : 'B') : null;
  const playing2: Two | null = st.playing && active === 2 ? (v === 6 ? 'B' : 'A') : null;
  return (
    <div className="stack card-soft card" style={{ gap: 12 }}>
      <h3 className="cal-group-title">{title}</h3>
      <ABChoice<Two | 'U'>
        options={[
          { value: 'A', label: `A ${tx('원래 소리', 'Original sound')}` },
          { value: 'B', label: `B ${moreLabel}` },
        ]}
        value={pick}
        unsureValue="U"
        playing={playing1}
        onListen={(x) => {
          set({ [field]: x === 'B' ? 3 : 0 } as Partial<Draft>);
          setPick2(null);
          onActivate(1);
          if (!engine.store.get().playing) engine.play();
        }}
        onChange={(x) => {
          setPick(x);
          if (x === 'U') set({ [field]: 0 } as Partial<Draft>);
        }}
      />
      {pick === 'B' && (
        <div className="stack" style={{ gap: 8 }} aria-live="polite">
          <p style={{ margin: 0, fontWeight: 600 }}>{tx('한 단계 더 해 볼까요?', 'Try one step more?')}</p>
          <ABChoice<Two>
            options={[
              { value: 'A', label: tx('지금 정도', 'As it is now') },
              { value: 'B', label: tx('한 단계 더', 'One step more') },
            ]}
            value={pick2}
            playing={playing2}
            onListen={(x) => {
              set({ [field]: x === 'B' ? 6 : 3 } as Partial<Draft>);
              onActivate(2);
              if (!engine.store.get().playing) engine.play();
            }}
            onChange={setPick2}
          />
        </div>
      )}
      {children}
    </div>
  );
}
export function Step4({ d, set, onHzTest }: StepProps & { onHzTest: () => void }) {
  const [hz, setHz] = useState<Two | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const sub = (k: string) => (active?.startsWith(k) ? (Number(active.slice(-1)) as 1 | 2) : null);
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>{tx('두 소리를 번갈아 들어 보세요. 어느 쪽이 더 편하게 들리나요?', 'Listen to the two sounds in turn. Which one is more comfortable?')}</p>
      <LoopPlayer />
      <Tone title={`1. ${tx('저음', 'Bass')}`} field="eqLowDb" moreLabel={tx('저음 조금 더', 'A little more bass')} d={d} set={set} active={sub('low')} onActivate={(n) => setActive(`low${n}`)} />
      <Tone title={`2. ${tx('또렷함', 'Clarity')}`} field="eqMidDb" moreLabel={tx('조금 더 또렷하게', 'A little clearer')} d={d} set={set} active={sub('mid')} onActivate={(n) => setActive(`mid${n}`)}>
        <details>
          <summary className="btn btn-sm" style={{ cursor: 'pointer' }}>{tx('다른 또렷함도 비교해 보기 (약 3 kHz)', 'Compare another clarity (about 3 kHz)')}</summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            <p className="small muted">{tx('시험 운영을 위한 비교예요. 더 또렷하게 들리는 쪽을 골라 보세요.', 'This comparison is for the pilot. Pick the one that sounds clearer.')}</p>
            <ABChoice<Two>
              options={[
                { value: 'A', label: `A ${tx('기본 또렷함', 'Default clarity')}` },
                { value: 'B', label: `B ${tx('약 3 kHz', 'about 3 kHz')}` },
              ]}
              value={hz}
              playing={engine.store.get().playing && active === 'hz' ? (d.eqMidHz === 3000 ? 'B' : 'A') : null}
              onListen={(x) => {
                onHzTest();
                setActive('hz');
                set({ eqMidHz: x === 'B' ? 3000 : 1700 });
                if (!engine.store.get().playing) engine.play();
              }}
              onChange={setHz}
            />
          </div>
        </details>
      </Tone>
      <p className="small muted">{tx('몇 번이든 다시 들어도 돼요. 잘 모르겠으면 그대로 두세요.', 'You can listen again as many times as you like. If you are not sure, leave it as it is.')}</p>
    </div>
  );
}

// ───────── ⑤ 악기 섞기 ─────────
export function Step5({ d, set, range }: StepProps & { range: { min: number; max: number; step: number } }) {
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>
        {tx('네 악기가 함께 연주해요. 가장 듣기 편한 비율로 섞어 보세요. 정답은 없어요.', 'Four instruments play together. Mix them in the way that is most comfortable for you. There is no right answer.')}
      </p>
      <LoopPlayer />
      {INSTRUMENTS.map((id: InstrumentId) => (
        <div className="cal-inst" key={id}>
          <div className="cal-inst-fig"><InstrumentFigure id={id} on size={64} /></div>
          <DbSlider
            label={INSTRUMENT_LABEL[id]}
            value={d.instGainDb[id]}
            min={range.min}
            max={range.max}
            step={range.step}
            formatValue={(v) => `${dbToLevel(v)} · ${loudnessWord(dbToLevel(v))}`}
            onChange={(v) => set({ instGainDb: { ...d.instGainDb, [id]: v } })}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => set({ instGainDb: { piano: 0, cajon: 0, bass: 0, trumpet: 0 } })}
      >
        <Icon name="refresh" /> {tx('처음 상태로', 'Reset')}
      </button>
    </div>
  );
}

// ───────── ⑥ 저음 도움 ─────────
export function Step6({ d, set, pick, setPick }: StepProps & { pick: BassAssist | 'unsure' | null; setPick: (p: BassAssist | 'unsure') => void }) {
  const opts: { v: BassAssist; l: string }[] = [
    { v: 'none', l: tx('원래 소리', 'Original sound') },
    { v: 'boost', l: tx('저음 키우기', 'Boost bass') },
    { v: 'octaveUp', l: tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up') },
  ];
  const listen = (v: BassAssist) => {
    set({ bassAssist: v, bassVizEmphasis: false });
    setPick(v);
    if (!engine.store.get().playing) engine.play();
  };
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>{tx('베이스만 연주해요. 줄을 튕기는 소리나 박자가 느껴지나요?', 'Only the bass is playing. Can you feel the plucked strings or the beat?')}</p>
      <LoopPlayer label={tx('베이스 2마디 반복', 'bass, 2 bars on loop')} />
      <div className="cal-choices cal-3" role="group" aria-label={tx('저음 도움 비교', 'Compare bass help')}>
        {opts.map((o, i) => (
          <Choice key={o.v} selected={pick === o.v} onClick={() => listen(o.v)}>
            {['A', 'B', 'C'][i]} {o.l}
          </Choice>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-block"
        aria-pressed={pick === 'unsure'}
        onClick={() => {
          set({ bassAssist: 'none', bassVizEmphasis: true });
          setPick('unsure');
        }}
      >
        {pick === 'unsure' && <Icon name="check" />}
        {tx('잘 모르겠어요', 'Not sure')}
      </button>
      {pick === 'unsure' && (
        <p className="cal-note">{tx('괜찮아요. 소리는 그대로 두고, 합주실 그림에서 저음의 박을 조금 더 눈에 띄게 보여 드릴게요.', 'That is fine. We will keep the sound as it is and make the bass beat easier to see in the room.')}</p>
      )}
      <p className="small muted">{tx('지금 선택:', 'Current choice:')} {d.bassAssist === 'none' ? tx('원래 소리', 'Original sound') : d.bassAssist === 'boost' ? tx('저음 키우기', 'Boost bass') : tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up')}</p>
    </div>
  );
}
