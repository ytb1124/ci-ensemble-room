// 확인용 갤러리: 모든 포즈 × 켜짐/꺼짐 × 선택 × 블라인드 × 컴팩트를 정적으로 보여 준다.
import { InstrumentCard } from './InstrumentCard';
import { InstrumentFigure, type FigurePose } from './figures';
import { INSTRUMENTS, INSTRUMENT_LABEL, type InstrumentId } from '../../types';
import './instruments.css';

const POSES: Record<InstrumentId, FigurePose[]> = {
  piano: ['idle', 'press'],
  cajon: ['idle', 'hitCenter', 'hitEdge'],
  bass: ['idle', 'pluck'],
  trumpet: ['idle', 'blow', 'rest'],
};
const noop = () => {};

export default function InstrumentGallery() {
  return (
    <div className="inst-gal">
      <h2>악기 일러스트 (포즈 × 켜짐/꺼짐)</h2>
      {INSTRUMENTS.map((id) => (
        <section key={id} style={{ display: 'grid', gap: 8 }}>
          <h3>{INSTRUMENT_LABEL[id]}</h3>
          <div className="inst-gal-row">
            {POSES[id].flatMap((pose) =>
              [true, false].map((on) => (
                <div key={pose + on} className="inst-gal-cell">
                  <span className="inst-art"><InstrumentFigure id={id} on={on} pose={pose} intensity={1} size={120} /></span>
                  {pose} · {on ? '켜짐' : '꺼짐'}
                </div>
              )),
            )}
            <div className="inst-gal-cell">
              <span className="inst-art"><InstrumentFigure id={id} on pose={POSES[id][1] ?? 'idle'} intensity={0.3} size={120} /></span>
              {POSES[id][1] ?? 'idle'} · 약하게
            </div>
          </div>
        </section>
      ))}

      <h2>카드 (375px 2×2 · 켜짐/꺼짐)</h2>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id) => (
          <InstrumentCard key={id} id={id} on selected={false} mode="solo" motion="off" animate={false} onPress={noop} />
        ))}
      </div>
      <h3>선택(솔로): 카혼만 켜짐</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id) => (
          <InstrumentCard key={id} id={id} on={id === 'cajon'} selected={id === 'cajon'} mode="solo" motion="off" animate={false} onPress={noop} />
        ))}
      </div>
      <h3>켜고 끄기 모드: 베이스 꺼짐</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id) => (
          <InstrumentCard key={id} id={id} on={id !== 'bass'} selected={false} mode="toggle" motion="off" animate={false} onPress={noop} />
        ))}
      </div>
      <h3>눈 가리고 듣기 (번호)</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id, i) => (
          <InstrumentCard key={id} id={id} on={i !== 1} selected={false} mode="toggle" motion="off" animate={false} blindNumber={i + 1} onPress={noop} />
        ))}
      </div>
      <h3>공개 후</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id, i) => (
          <InstrumentCard key={id} id={id} on={i !== 1} selected={i === 2} mode="toggle" motion="off" animate={false} blindNumber={i + 1} revealed onPress={noop} />
        ))}
      </div>
      <h3>컴팩트</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id, i) => (
          <InstrumentCard key={id} id={id} on={i !== 2} selected={i === 0} mode="solo" motion="off" animate={false} compact onPress={noop} />
        ))}
      </div>
      <h3>컴팩트 · 눈 가리고 듣기</h3>
      <div className="inst-gal-four">
        {INSTRUMENTS.map((id, i) => (
          <InstrumentCard key={id} id={id} on selected={false} mode="toggle" motion="off" animate={false} compact blindNumber={i + 1} onPress={noop} />
        ))}
      </div>
      <h3>넓은 카드 (태블릿/데스크톱)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 220px))', gap: 12 }}>
        {INSTRUMENTS.map((id) => (
          <InstrumentCard key={id} id={id} on selected={id === 'bass'} mode="solo" motion="off" animate={false} onPress={noop} />
        ))}
      </div>
    </div>
  );
}
