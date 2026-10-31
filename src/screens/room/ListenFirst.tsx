import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chip } from '../../components/ui/controls';
import { Icon, type IconName } from '../../components/ui/Icon';
import { engine } from '../../audio/useEngine';
import { logEvent } from '../../store/log';
import { ko, tx } from '../../i18n';

// 처음 합주실에 들어오면 뜨는 "듣기 순서" 안내.
// 10/28 피드백: 카드 한 줄로는 무엇인지 알기 어려워서, 처음엔 팝업으로 왜·어떻게를 설명하고
// 듣는 동안에는 아래쪽에 떠 있는 안내로 지금 몇 번째인지 보여 준다.
const STEPS: { icon: IconName; title: string; short: string; text: string; view: 'off' | 'lanes' | null }[] = [
  {
    icon: 'headphones',
    get title() { return tx('① 소리만 듣기', '① Sound only'); },
    get short() { return tx('소리만', 'Sound only'); },
    get text() { return tx('그림 없이 소리만 들어 보세요. 어떤 소리가 나는지 귀 기울여 보세요.', 'Listen without the picture. Pay attention to what you hear.'); },
    view: 'off',
  },
  {
    icon: 'eye',
    get title() { return tx('② 보며 듣기', '② Watch and listen'); },
    get short() { return tx('보며 듣기', 'Watch'); },
    get text() { return tx('이번에는 그림과 함께 들어 보세요. 소리가 날 때마다 동그라미가 커져요.', 'Now listen while you watch the picture. The circles grow each time a sound plays.'); },
    view: 'lanes',
  },
  {
    icon: 'headphones',
    get title() { return tx('③ 다시 소리만 듣기', '③ Sound only again'); },
    get short() { return tx('다시 소리만', 'Sound again'); },
    get text() { return tx('다시 소리만 들어 보세요. 그림에서 본 것이 들리나요?', 'Listen to the sound only again. Can you hear what you saw in the picture?'); },
    view: 'off',
  },
  {
    icon: 'check',
    get title() { return tx('④ 들린 것 고르기', '④ Pick what you heard'); },
    get short() { return tx('고르기', 'Pick'); },
    get text() { return tx('무엇이 들렸나요?', 'What did you hear?'); },
    view: null,
  },
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

function Stepper({ step }: { step: number }) {
  return (
    <ol className="lf-stepper" aria-label={tx(ko`듣기 순서 ${step + 1} / 4`, `Listening step ${step + 1} of 4`)}>
      {STEPS.map((s, i) => (
        <li key={i} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="lf-dot" aria-hidden="true">{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
          <span className="lf-dot-label">{s.short}</span>
        </li>
      ))}
    </ol>
  );
}

export function ListenFirst({ onView, onDone }: { onView: (v: 'off' | 'lanes') => void; onDone: () => void }) {
  const [step, setStep] = useState<number | 'intro'>('intro');
  const [picked, setPicked] = useState<string[]>([]);

  const skip = () => {
    logEvent({ type: 'card', cardId: 'listenFirst', answer: 'close' });
    onDone();
  };
  const go = (n: number) => {
    setStep(n);
    const v = STEPS[n]?.view;
    if (v) onView(v);
  };
  const begin = () => {
    go(0);
    if (!engine.state.playing) engine.play();
  };
  const finish = () => {
    if (picked.length) logEvent({ type: 'card', cardId: `listenFirst:${picked.join(',')}`, answer: 'heard' });
    else logEvent({ type: 'card', cardId: 'listenFirst', answer: 'close' });
    onDone();
  };

  const modal = step === 'intro' || step === 3;
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  if (step === 'intro') {
    // 보기 칸(sticky) 안에 있으면 재생 막대 아래로 깔리므로 body에 띄운다
    return createPortal(
      <div className="lf-backdrop">
        <div className="lf-modal card" role="dialog" aria-modal="true" aria-labelledby="lf-title" aria-describedby="lf-desc">
          <p className="lf-kicker">{tx('처음 오셨네요', 'Welcome')}</p>
          <h2 id="lf-title">{tx('이렇게 4단계로 들어 볼까요?', 'Shall we listen in 4 steps?')}</h2>
          <p id="lf-desc" className="lf-desc">
            {tx('소리만 듣고 → 그림과 함께 듣고 → 다시 소리만 들으면, 그림에서 본 것이 귀로도 더 잘 잡혀요. 1–2분이면 끝나요.', 'Sound only → with the picture → sound only again. Going back and forth helps you hear what you saw. It takes 1–2 minutes.')}
          </p>
          <ol className="lf-overview">
            {STEPS.map((s, i) => (
              <li key={i}>
                <span className="lf-ov-icon" aria-hidden="true"><Icon name={s.icon} size={24} /></span>
                <span className="lf-ov-title">{s.title}</span>
                <span className="lf-ov-text">{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="small muted" style={{ margin: 0 }}>{tx('정답은 없어요. 언제든 그만둘 수 있어요.', 'There is no right answer. You can stop at any time.')}</p>
          <div className="lf-actions">
            <button type="button" className="btn btn-ghost" onClick={skip}>{tx('건너뛰기', 'Skip')}</button>
            <button type="button" className="btn btn-primary btn-lg" autoFocus onClick={begin}>
              <Icon name="play" />{tx('시작하기', 'Start')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const s = STEPS[step];
  if (step === 3) {
    return createPortal(
      <div className="lf-backdrop">
        <div className="lf-modal card" role="dialog" aria-modal="true" aria-labelledby="lf-title">
          <Stepper step={step} />
          <h2 id="lf-title">{s.text}</h2>
          <p className="lf-desc">{tx('들린 것을 모두 골라 주세요. 없으면 그냥 끝내도 돼요.', 'Pick everything you heard. If nothing, you can just finish.')}</p>
          <div className="row" role="group" aria-label={tx('들린 것', 'What you heard')}>
            {CHIPS.map((c) => (
              <Chip key={c} pressed={picked.includes(c)} onClick={() => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c])}>
                {chipLabel(c)}
              </Chip>
            ))}
          </div>
          <div className="lf-actions">
            <button type="button" className="btn btn-ghost" onClick={() => go(2)}>{tx('이전', 'Back')}</button>
            <button type="button" className="btn btn-primary btn-lg" autoFocus onClick={finish}>{tx('끝내기', 'Finish')}</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ①–③: 음악을 들으며 볼 수 있게 화면을 가리지 않는 떠 있는 안내
  return (
    <section className="lf-float card" aria-label={tx('듣기 순서', 'Listening steps')}>
      <Stepper step={step} />
      <div className="lf-float-body">
        <span className="lf-ov-icon" aria-hidden="true"><Icon name={s.icon} size={24} /></span>
        <div className="lf-float-text">
          <p className="lf-float-title">{s.title}</p>
          <p role="status">{s.text}</p>
        </div>
      </div>
      <div className="lf-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>{tx('그만하기', 'Stop')}</button>
        <button type="button" className="btn btn-primary" onClick={() => go(step + 1)}>
          {tx('다음', 'Next')}<Icon name="chevronRight" size={18} />
        </button>
      </div>
    </section>
  );
}
