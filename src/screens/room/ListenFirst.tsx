import { useState } from 'react';
import { Chip } from '../../components/ui/controls';
import { logEvent } from '../../store/log';

const STEPS = [
  { title: '① 소리만 듣기', text: '먼저 소리만 들어 보세요.', view: 'off' as const },
  { title: '② 보며 듣기', text: '이번에는 그림과 함께 들어 보세요. 소리가 날 때마다 동그라미가 커져요.', view: 'lanes' as const },
  { title: '③ 다시 소리만 듣기', text: '다시 소리만 들어 보세요. 그림에서 본 것이 들리나요?', view: 'off' as const },
  { title: '④ 들린 것 고르기', text: '무엇이 들렸나요?', view: null },
];
const CHIPS = ['박자', '높낮이', '악기 구분', '잘 모르겠어요'];

export function ListenFirst({ onView, onDone }: { onView: (v: 'off' | 'lanes') => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const s = STEPS[step];

  const go = (n: number) => {
    setStep(n);
    const v = STEPS[n]?.view;
    if (v) onView(v);
  };
  const finish = () => {
    if (picked.length) logEvent({ type: 'card', cardId: `listenFirst:${picked.join(',')}`, answer: 'heard' });
    else logEvent({ type: 'card', cardId: 'listenFirst', answer: 'close' });
    onDone();
  };

  return (
    <section className="card card-soft room-steps" aria-label="듣기 순서">
      <p className="small" style={{ margin: 0, fontWeight: 700 }}>듣기 순서 {step + 1} / 4 · {s.title}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }} role="status">{s.text}</p>
      {step === 3 && (
        <div className="row" role="group" aria-label="들린 것">
          {CHIPS.map((c) => (
            <Chip key={c} pressed={picked.includes(c)} onClick={() => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c])}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      <div className="row">
        {step < 3 ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => go(step + 1)}>다음</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={finish}>끝내기</button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>건너뛰기</button>
      </div>
    </section>
  );
}
