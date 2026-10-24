import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { ClipId } from '../../audio/probeAudio';
import { Chip } from '../../components/ui/controls';
import { CHIPS } from '../../config/probes';
import { tx } from '../../i18n';
import { addProbeResponse } from '../../store/probe';
import type { ChipId, ProbeItem } from '../../types';
import { ListenButton, ProgressBar, useProbeClips, type ItemRand } from './probeShared';

type ItemA = Extract<ProbeItem, { kind: 'A' }>;

function sliderText(v: number) {
  return v < 34 ? tx('똑같아요 쪽', 'Toward exactly the same') : v > 66 ? tx('아주 달라요 쪽', 'Toward very different') : tx('중간', 'Middle');
}

export default function ProbeA({
  set,
  item,
  rand,
  index,
  total,
  practice,
  onNext,
}: {
  set: 1 | 2;
  item: ItemA;
  rand: ItemRand;
  index: number;
  total: number;
  practice?: boolean;
  onNext: () => void;
}) {
  const edited: ClipId = item.cue === 'ref' ? 'orig' : item.cue;
  const { bufs, error } = useProbeClips(['orig', edited]);
  const [listens, setListens] = useState({ A: 0, B: 0 });
  const [value, setValue] = useState(rand.sliderStart);
  const [touched, setTouched] = useState(false);
  const [chips, setChips] = useState<ChipId[]>([]);
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const done = useRef(false);

  const clipFor = (side: 'A' | 'B'): ClipId => ((side === 'A') === rand.origIsA ? 'orig' : edited);
  const listen = (side: 'A' | 'B') => {
    const b = bufs?.[clipFor(side)];
    if (!b) return;
    engine.playClip(b, `probe-${side}`);
    setListens((l) => ({ ...l, [side]: l[side] + 1 }));
  };

  const heard = listens.A + listens.B > 0;
  const canNext = heard && touched;
  const why = !heard
    ? tx('소리 A나 B를 한 번 들어 주세요.', 'Please listen to sound A or B once.')
    : !touched
      ? tx('손잡이를 한 번 움직이거나 [이대로 좋아요]를 눌러 주세요.', 'Please move the slider once or press [Looks good].')
      : '';

  const finish = (skip: boolean) => {
    if (done.current) return;
    done.current = true;
    engine.stopClip();
    if (!practice) {
      addProbeResponse({
        kind: 'A',
        set,
        itemId: item.id,
        cue: item.cue,
        isRepeat: !!item.repeatOf,
        origIsA: rand.origIsA,
        sliderStart: rand.sliderStart,
        rating: skip ? null : value,
        chips: skip ? [] : chips,
        otherText: skip || !chips.includes('other') ? '' : other.trim(),
        note: skip ? '' : note.trim(),
        listensA: listens.A,
        listensB: listens.B,
        at: new Date().toISOString(),
      });
    }
    onNext();
  };

  const toggle = (id: ChipId) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="stack-lg">
      <ProgressBar index={index} total={total} title={practice ? tx('연습', 'Practice') : undefined} />
      {practice && <p className="small" style={{ margin: 0 }}>{tx('연습이에요. 저장하지 않아요.', 'This is practice. Nothing is saved.')}</p>}
      <p style={{ margin: 0 }}>
        {tx(
          '두 소리를 원하는 만큼 들어 보세요. 정답은 없으니 느낀 만큼만 표시해 주세요.',
          'Listen to the two sounds as many times as you like. There are no right answers. Just mark what you feel.',
        )}
      </p>
      {error && <p role="alert" style={{ margin: 0 }}>{tx('소리를 준비하지 못했어요. [넘어가기]를 눌러 주세요.', "We couldn't get the sounds ready. Please press [Skip].")}</p>}
      {!bufs && !error && <p style={{ margin: 0 }} role="status">{tx('소리를 준비하고 있어요…', 'Getting the sounds ready…')}</p>}
      <div className="probe-listen-row">
        <ListenButton label={tx('소리 A 듣기', 'Play sound A')} clipId="probe-A" disabled={!bufs} onPress={() => listen('A')} />
        <ListenButton label={tx('소리 B 듣기', 'Play sound B')} clipId="probe-B" disabled={!bufs} onPress={() => listen('B')} />
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <label htmlFor="probe-slider" className="probe-q">{tx('두 소리가 얼마나 달라요?', 'How different are the two sounds?')}</label>
        <div className="probe-slider-ends" aria-hidden="true">
          <span>{tx('똑같아요', 'Exactly the same')}</span>
          <span>{tx('아주 달라요', 'Very different')}</span>
        </div>
        <input
          id="probe-slider"
          className="range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-valuetext={sliderText(value)}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setTouched(true);
          }}
        />
        <p className="small" style={{ margin: 0 }}>
          {tx(
            '손잡이의 처음 위치는 매번 달라요. 한 번 움직이거나 [이대로 좋아요]를 눌러 주세요.',
            'The slider starts in a different place each time. Move it once or press [Looks good].',
          )}
        </p>
        <div>
          <button type="button" className={`btn${touched ? ' is-selected' : ''}`} aria-pressed={touched} onClick={() => setTouched(true)}>
            {touched ? tx('표시했어요', 'Rated') : tx('이대로 좋아요', 'Looks good')}
          </button>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <p className="probe-q" id="probe-chips-l">{tx('무엇이 다르게 느껴졌나요? (여러 개 골라도 돼요)', 'What felt different? (You can pick more than one)')}</p>
        <div className="probe-chips" role="group" aria-labelledby="probe-chips-l">
          {CHIPS.map((c) => (
            <Chip key={c.id} pressed={chips.includes(c.id)} onClick={() => toggle(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        {chips.includes('other') && (
          <input className="input" aria-label={tx('기타: 어떤 점이 달랐나요', 'Other: what was different')} maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} placeholder={tx('어떤 점이 달랐나요?', 'What was different?')} />
        )}
        <input className="input" aria-label={tx('한 줄로 적어 볼까요? (선택)', 'Want to write a line about it? (optional)')} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('예: 두 번째가 덜 톡 튀었어요', 'e.g., The second one was less punchy')} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {!canNext && <p className="probe-why small" role="status" style={{ margin: 0 }}>{why}</p>}
        <div className="probe-actions">
          <button type="button" className="btn btn-lg btn-primary" disabled={!canNext} onClick={() => finish(false)}>{tx('다음', 'Next')}</button>
          <button type="button" className="btn btn-lg" onClick={() => finish(true)}>{tx('넘어가기', 'Skip')}</button>
        </div>
      </div>
    </div>
  );
}
