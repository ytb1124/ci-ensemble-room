import { useState } from 'react';
import { Chip } from '../../components/ui/controls';
import { logEvent } from '../../store/log';
import { tx } from '../../i18n';

const STEPS = [
  { get title() { return tx('① 소리만 듣기', '① Sound only'); }, get text() { return tx('먼저 소리만 들어 보세요.', 'First, just listen to the sound.'); }, view: 'off' as const },
  { get title() { return tx('② 보며 듣기', '② Watch and listen'); }, get text() { return tx('이번에는 그림과 함께 들어 보세요. 소리가 날 때마다 동그라미가 커져요.', 'Now listen while you watch the picture. The circles grow each time a sound plays.'); }, view: 'lanes' as const },
  { get title() { return tx('③ 다시 소리만 듣기', '③ Sound only again'); }, get text() { return tx('다시 소리만 들어 보세요. 그림에서 본 것이 들리나요?', 'Listen to the sound only again. Can you hear what you saw in the picture?'); }, view: 'off' as const },
  { get title() { return tx('④ 들린 것 고르기', '④ Pick what you heard'); }, get text() { return tx('무엇이 들렸나요?', 'What did you hear?'); }, view: null },
];
// 칩 값(한국어)은 기록(cardId)에 그대로 남기고, 화면 글자만 바꾼다
const CHIPS = ['박자', '높낮이', '악기 구분', '잘 모르겠어요'];
const chipLabel = (c: string) =>
  ({
    박자: tx('박자', 'Beat'),
    높낮이: tx('높낮이', 'Pitch'),
    '악기 구분': tx('악기 구분', 'Telling instruments apart'),
    '잘 모르겠어요': tx('잘 모르겠어요', 'Not sure'),
  } as Record<string, string>)[c] ?? c;

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
    <section className="card card-soft room-steps" aria-label={tx('듣기 순서', 'Listening steps')}>
      <p className="small" style={{ margin: 0, fontWeight: 700 }}>{tx(`듣기 순서 ${step + 1} / 4`, `Listening step ${step + 1} of 4`)} · {s.title}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }} role="status">{s.text}</p>
      {step === 3 && (
        <div className="row" role="group" aria-label={tx('들린 것', 'What you heard')}>
          {CHIPS.map((c) => (
            <Chip key={c} pressed={picked.includes(c)} onClick={() => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c])}>
              {chipLabel(c)}
            </Chip>
          ))}
        </div>
      )}
      <div className="row">
        {step < 3 ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => go(step + 1)}>{tx('다음', 'Next')}</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={finish}>{tx('끝내기', 'Finish')}</button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>{tx('건너뛰기', 'Skip')}</button>
      </div>
    </section>
  );
}
