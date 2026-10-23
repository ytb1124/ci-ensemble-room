import { useState } from 'react';
import { Chip } from '../../components/ui/controls';
import { REFLECTION_CHIPS } from '../../config/probes';
import type { ChipId } from '../../types';
import './probe.css';

export default function Reflection({ onSubmit }: { onSubmit: (chips: ChipId[], text: string) => void }) {
  const [chips, setChips] = useState<ChipId[]>([]);
  const [text, setText] = useState('');
  const toggle = (id: ChipId) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="stack-lg">
      <h1 style={{ margin: 0, fontSize: 24 }}>마지막 질문이에요</h1>
      <p className="lead" style={{ margin: 0 }}>
        오늘 합주실에서 소리를 구별할 때 무엇에 가장 기대었나요? 하나만 골라도 되고, 한 줄로 설명해 주시면 나중에 다시 볼 수 있어요.
      </p>
      <div className="probe-chips" role="group" aria-label="기댄 것">
        {REFLECTION_CHIPS.map((c) => (
          <Chip key={c.id} pressed={chips.includes(c.id)} onClick={() => toggle(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <label htmlFor="probe-refl" className="probe-q">한 줄 설명 (선택)</label>
        <input id="probe-refl" className="input" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="probe-actions">
        <button type="button" className="btn btn-lg btn-primary" onClick={() => onSubmit(chips, text.trim())}>끝내기</button>
      </div>
    </div>
  );
}
