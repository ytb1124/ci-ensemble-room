// 보정 단계별 화면(구성안 4.1). 값은 상위(Calibrate)의 draft로 들고, 소리는 engine.setPreview로 미리 듣는다.
import { useState, type ReactNode } from 'react';
import type { BassAssist, DeviceConfig, InstrumentId, Maker, Profile, Route } from '../../types';
import { INSTRUMENTS, INSTRUMENT_LABEL } from '../../types';
import { engine, useEngineState } from '../../audio/useEngine';
import { ABChoice, DbSlider } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { InstrumentFigure } from '../../components/instruments/InstrumentCard';

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
  bilateral: '양쪽 인공와우',
  unilateral: '한쪽 인공와우',
  bimodal: '인공와우 + 반대쪽 보청기',
  ssd: '인공와우 + 반대쪽은 잘 들림',
  unknown: '잘 모르겠어요',
};
export const ROUTE_LABEL: Record<Route, string> = {
  direct: '프로세서에 직접 연결 (블루투스·스트리머·선)',
  speaker: '스피커',
  headphones: '이어폰·헤드폰',
};
export const MAKER_LABEL: Record<NonNullable<Maker>, string> = {
  cochlear: '코클리어',
  medel: '메드엘',
  ab: '어드밴스드 바이오닉스',
  oticon: '오티콘',
  unknown: '잘 모르겠어요',
};
const ROUTE_REC: Partial<Record<DeviceConfig, Route>> = {
  ssd: 'speaker', bimodal: 'speaker', unilateral: 'direct', bilateral: 'direct',
};
const ROUTE_REC_TEXT: Record<DeviceConfig, string> = {
  ssd: '스피커로 양쪽 귀로 함께 듣는 쪽을 더 좋아한 분이 많았어요. 직접 연결과 비교해 봐도 좋아요.',
  bimodal: '스피커로 양쪽 귀로 함께 듣는 쪽을 더 좋아한 분이 많았어요. 직접 연결과 비교해 봐도 좋아요. 보청기도 함께 끼고 들어 보세요.',
  unilateral: '이런 분들은 직접 연결을 조금 더 좋아하거나, 차이를 크게 느끼지 않았어요.',
  bilateral: '이런 분들은 직접 연결을 조금 더 좋아하거나, 차이를 크게 느끼지 않았어요.',
  unknown: '지금 듣는 방식 그대로 시작해요.',
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
export function LoopPlayer({ label = '합주 4마디 반복' }: { label?: string }) {
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
      {st.playing ? '정지' : `재생 (${label})`}
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
      <p className="cal-note">처음 소리를 정하는 데만 써요. 시험이 아니에요.</p>
      <div className="stack" role="group" aria-labelledby="cal-q-config">
        <h3 className="cal-group-title" id="cal-q-config">어떻게 듣고 있나요?</h3>
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
        <h3 className="cal-group-title" id="cal-q-route">소리는 어디로 들어가나요?</h3>
        <div className="cal-choices">
          {routes.map((r) => (
            <Choice key={r} selected={d.route === r} onClick={() => set({ route: r })}>
              {ROUTE_LABEL[r]}
            </Choice>
          ))}
        </div>
        {d.config && (
          <p className="cal-note" aria-live="polite">
            {ROUTE_REC_TEXT[d.config]} (처음 권하는 방법일 뿐이에요. 바꿔도 돼요.)
          </p>
        )}
      </div>
      <div className="stack" role="group" aria-labelledby="cal-q-maker">
        <h3 className="cal-group-title" id="cal-q-maker">인공와우 회사 (선택)</h3>
        <div className="cal-choices">
          {makers.map((m) => (
            <Choice key={m} selected={d.maker === m} onClick={() => set({ maker: d.maker === m ? null : m })}>
              {MAKER_LABEL[m]}
            </Choice>
          ))}
        </div>
      </div>
      <p className="small muted">
        프로세서에서 저음·고음을 따로 바꿔 두었다면, 평소 설정 그대로 두고 맞춰 주세요.
      </p>
    </div>
  );
}

// ───────── ② 편안한 크기 ─────────
export function Step2({ d, set, onCommit }: StepProps & { onCommit: (v: number) => void }) {
  return (
    <div className="stack-lg">
      <ol className="cal-list">
        <li>음악이 편안하게 들릴 때까지 휴대폰(또는 프로세서) 음량을 조절해 주세요.</li>
        <li>아래 [앱 음량]으로 조금 더 맞춰도 돼요.</li>
        <li>다 맞췄으면 기기 음량은 되도록 그대로 두세요.</li>
      </ol>
      <LoopPlayer />
      <DbSlider
        label="앱 음량"
        value={d.masterGainDb}
        min={-6}
        max={6}
        step={1}
        onChange={(v) => set({ masterGainDb: v })}
        onCommit={onCommit}
      />
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
  if (bd) text = '왼쪽 / 가운데 / 오른쪽 중 어디가 편해요?';
  else if (d.config === 'bimodal')
    text = (<>양쪽에 같은 소리를 보내요(모노). <strong>보청기도 함께 끼고 들어 보세요.</strong></>);
  else if (d.config === 'ssd') text = '양쪽으로 함께 들어 보세요.';
  else text = '양쪽에 같은 소리를 보내요(모노).';
  const bal: { v: -1 | 0 | 1; l: string }[] = [
    { v: -1, l: '왼쪽' }, { v: 0, l: '가운데' }, { v: 1, l: '오른쪽' },
  ];
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>{text}</p>
      <LoopPlayer />
      {bd && (
        <>
          <div className="cal-choices cal-3" role="group" aria-label="좌우 밸런스">
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
            넓게 펼쳐 듣기 {d.spread ? '켜짐' : '꺼짐'} (선택)
          </button>
          <p className="small muted">카혼은 왼쪽, 피아노는 조금 왼쪽, 베이스는 가운데, 트럼펫은 오른쪽에서 들려요.</p>
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
          { value: 'A', label: 'A 원래 소리' },
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
          <p style={{ margin: 0, fontWeight: 600 }}>한 단계 더 해 볼까요?</p>
          <ABChoice<Two>
            options={[
              { value: 'A', label: '지금 정도' },
              { value: 'B', label: '한 단계 더' },
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
      <p className="lead" style={{ margin: 0 }}>두 소리를 번갈아 들어 보세요. 어느 쪽이 더 편하게 들리나요?</p>
      <LoopPlayer />
      <Tone title="1. 저음" field="eqLowDb" moreLabel="저음 조금 더" d={d} set={set} active={sub('low')} onActivate={(n) => setActive(`low${n}`)} />
      <Tone title="2. 또렷함" field="eqMidDb" moreLabel="조금 더 또렷하게" d={d} set={set} active={sub('mid')} onActivate={(n) => setActive(`mid${n}`)}>
        <details>
          <summary className="btn btn-sm" style={{ cursor: 'pointer' }}>다른 또렷함도 비교해 보기 (약 3 kHz)</summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            <p className="small muted">시험 운영을 위한 비교예요. 더 또렷하게 들리는 쪽을 골라 보세요.</p>
            <ABChoice<Two>
              options={[
                { value: 'A', label: 'A 기본 또렷함' },
                { value: 'B', label: 'B 약 3 kHz' },
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
      <p className="small muted">몇 번이든 다시 들어도 돼요. 잘 모르겠으면 그대로 두세요.</p>
    </div>
  );
}

// ───────── ⑤ 악기 섞기 ─────────
export function Step5({ d, set, range }: StepProps & { range: { min: number; max: number; step: number } }) {
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>
        네 악기가 함께 연주해요. 가장 듣기 편한 비율로 섞어 보세요. 정답은 없어요.
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
            onChange={(v) => set({ instGainDb: { ...d.instGainDb, [id]: v } })}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => set({ instGainDb: { piano: 0, cajon: 0, bass: 0, trumpet: 0 } })}
      >
        <Icon name="refresh" /> 처음 상태로
      </button>
    </div>
  );
}

// ───────── ⑥ 저음 도움 ─────────
export function Step6({ d, set, pick, setPick }: StepProps & { pick: BassAssist | 'unsure' | null; setPick: (p: BassAssist | 'unsure') => void }) {
  const opts: { v: BassAssist; l: string }[] = [
    { v: 'none', l: '원래 소리' },
    { v: 'boost', l: '저음 키우기' },
    { v: 'octaveUp', l: '베이스를 높게 겹쳐 듣기' },
  ];
  const listen = (v: BassAssist) => {
    set({ bassAssist: v, bassVizEmphasis: false });
    setPick(v);
    if (!engine.store.get().playing) engine.play();
  };
  return (
    <div className="stack-lg">
      <p className="lead" style={{ margin: 0 }}>베이스만 연주해요. 줄을 튕기는 소리나 박자가 느껴지나요?</p>
      <LoopPlayer label="베이스 2마디 반복" />
      <div className="cal-choices cal-3" role="group" aria-label="저음 도움 비교">
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
        잘 모르겠어요
      </button>
      {pick === 'unsure' && (
        <p className="cal-note">괜찮아요. 소리는 그대로 두고, 합주실 그림에서 저음의 박을 조금 더 눈에 띄게 보여 드릴게요.</p>
      )}
      <p className="small muted">지금 선택: {d.bassAssist === 'none' ? '원래 소리' : d.bassAssist === 'boost' ? '저음 키우기' : '베이스를 높게 겹쳐 듣기'}</p>
    </div>
  );
}
