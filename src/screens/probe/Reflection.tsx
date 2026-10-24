import { useState } from 'react';
import { Chip } from '../../components/ui/controls';
import { REFLECTION_CHIPS } from '../../config/probes';
import { tx } from '../../i18n';
import type { ChipId } from '../../types';
import './probe.css';

export default function Reflection({ onSubmit }: { onSubmit: (chips: ChipId[], text: string) => void }) {
  const [chips, setChips] = useState<ChipId[]>([]);
  const [text, setText] = useState('');
  const toggle = (id: ChipId) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="stack-lg">
      <h1 style={{ margin: 0, fontSize: 24 }}>{tx('마지막 질문이에요', 'Last question')}</h1>
      <p className="lead" style={{ margin: 0 }}>
        {tx(
          '오늘 소리를 구별할 때 무엇에 가장 기댔나요? 고르기만 해도 되고, 한 줄로 적어도 돼요. 적은 내용은 나중에 다시 볼 수 있어요.',
          'Today, what did you rely on most to tell the sounds apart? You can just pick, or write a line. You can see what you wrote again later.',
        )}
      </p>
      <div className="probe-chips" role="group" aria-label={tx('기댄 것', 'What you relied on')}>
        {REFLECTION_CHIPS.map((c) => (
          <Chip key={c.id} pressed={chips.includes(c.id)} onClick={() => toggle(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <label htmlFor="probe-refl" className="probe-q">{tx('한 줄로 적기 (선택)', 'Write a line (optional)')}</label>
        <input id="probe-refl" className="input" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="probe-actions">
        <button type="button" className="btn btn-lg btn-primary" onClick={() => onSubmit(chips, text.trim())}>{tx('끝내기', 'Finish')}</button>
      </div>
    </div>
  );
}
