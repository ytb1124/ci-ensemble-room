import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { ClipId } from '../../audio/probeAudio';
import { Chip } from '../../components/ui/controls';
import { CHIPS } from '../../config/probes';
import { addProbeResponse } from '../../store/probe';
import type { ChipId, ProbeItem } from '../../types';
import { ListenButton, ProgressBar, useProbeClips, type ItemRand } from './probeShared';

type ItemA = Extract<ProbeItem, { kind: 'A' }>;

function sliderText(v: number) {
  return v < 34 ? '똑같아요 쪽' : v > 66 ? '아주 달라요 쪽' : '중간';
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
  const why = !heard ? '소리 A나 B를 한 번 들어 주세요.' : !touched ? '손잡이를 한 번 움직이거나 [이대로 좋아요]를 눌러 주세요.' : '';

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
      <ProgressBar index={index} total={total} title={practice ? '연습' : undefined} />
      {practice && <p className="small" style={{ margin: 0 }}>연습이에요. 저장하지 않아요.</p>}
      <p style={{ margin: 0 }}>두 소리를 원하는 만큼 들어 보세요. 정답은 없어요. 느낀 만큼만 표시해 주세요.</p>
      {error && <p role="alert" style={{ margin: 0 }}>소리를 준비하지 못했어요. [넘어가기]를 눌러 주세요.</p>}
      {!bufs && !error && <p style={{ margin: 0 }} role="status">소리를 준비하고 있어요…</p>}
      <div className="probe-listen-row">
        <ListenButton label="소리 A 듣기" clipId="probe-A" disabled={!bufs} onPress={() => listen('A')} />
        <ListenButton label="소리 B 듣기" clipId="probe-B" disabled={!bufs} onPress={() => listen('B')} />
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <label htmlFor="probe-slider" className="probe-q">두 소리가 얼마나 달라요?</label>
        <div className="probe-slider-ends" aria-hidden="true">
          <span>똑같아요</span>
          <span>아주 달라요</span>
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
        <p className="small" style={{ margin: 0 }}>손잡이는 아무 곳에서나 시작해요. 한 번 움직이거나 [이대로 좋아요]를 눌러 주세요.</p>
        <div>
          <button type="button" className={`btn${touched ? ' is-selected' : ''}`} aria-pressed={touched} onClick={() => setTouched(true)}>
            {touched ? '표시했어요' : '이대로 좋아요'}
          </button>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <p className="probe-q" id="probe-chips-l">무엇이 다르게 느껴졌나요? (여러 개 골라도 돼요)</p>
        <div className="probe-chips" role="group" aria-labelledby="probe-chips-l">
          {CHIPS.map((c) => (
            <Chip key={c.id} pressed={chips.includes(c.id)} onClick={() => toggle(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        {chips.includes('other') && (
          <input className="input" aria-label="기타: 어떤 점이 달랐나요" maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} placeholder="어떤 점이 달랐나요?" />
        )}
        <input className="input" aria-label="한 줄로 적어 볼까요? (선택)" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 두 번째가 덜 톡 튀었어요" />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {!canNext && <p className="probe-why small" role="status" style={{ margin: 0 }}>{why}</p>}
        <div className="probe-actions">
          <button type="button" className="btn btn-lg btn-primary" disabled={!canNext} onClick={() => finish(false)}>다음</button>
          <button type="button" className="btn btn-lg" onClick={() => finish(true)}>넘어가기</button>
        </div>
      </div>
    </div>
  );
}
