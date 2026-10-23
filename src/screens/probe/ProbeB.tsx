import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { emphClip } from '../../audio/probeAudio';
import { addProbeResponse } from '../../store/probe';
import type { ProbeItem, ProbeResponseB } from '../../types';
import { Choices, ListenButton, ProgressBar, useProbeClips, type ItemRand } from './probeShared';

type ItemB = Extract<ProbeItem, { kind: 'B' }>;

export default function ProbeB({
  set,
  item,
  rand,
  index,
  total,
  onNext,
}: {
  set: 1 | 2;
  item: ItemB;
  rand: ItemRand;
  index: number;
  total: number;
  onNext: () => void;
}) {
  const [a, b] = rand.flip ? [item.pair[1], item.pair[0]] : item.pair;
  const { bufs, error } = useProbeClips([emphClip(a), emphClip(b)]);
  const [listens, setListens] = useState({ A: 0, B: 0 });
  const [clearer, setClearer] = useState<ProbeResponseB['clearer']>(null);
  const [confidence, setConfidence] = useState<ProbeResponseB['confidence']>(null);
  const [preferSame, setPreferSame] = useState<ProbeResponseB['preferSame']>(null);
  const done = useRef(false);

  const listen = (side: 'A' | 'B') => {
    const buf = bufs?.[emphClip(side === 'A' ? a : b)];
    if (!buf) return;
    engine.playClip(buf, `probe-${side}`);
    setListens((l) => ({ ...l, [side]: l[side] + 1 }));
  };

  const heard = listens.A + listens.B > 0;
  const canNext = heard && clearer !== null;
  const why = !heard ? '소리 A나 B를 한 번 들어 주세요.' : '"어느 쪽이 더 또렷해요?"에 답해 주세요.';

  const finish = (skip: boolean) => {
    if (done.current) return;
    done.current = true;
    engine.stopClip();
    addProbeResponse({
      kind: 'B',
      set,
      itemId: item.id,
      a,
      b,
      clearer: skip ? null : clearer,
      confidence: skip ? null : confidence,
      preferSame: skip ? null : preferSame,
      listensA: listens.A,
      listensB: listens.B,
      at: new Date().toISOString(),
    });
    onNext();
  };

  return (
    <div className="stack-lg">
      <ProgressBar index={index} total={total} />
      <p className="probe-q">두 버전을 들어 보세요. 어느 쪽이 나에게 더 또렷하게 들려요?</p>
      {error && <p role="alert" style={{ margin: 0 }}>소리를 준비하지 못했어요. [넘어가기]를 눌러 주세요.</p>}
      {!bufs && !error && <p style={{ margin: 0 }} role="status">소리를 준비하고 있어요…</p>}
      <div className="probe-listen-row">
        <ListenButton label="A 듣기" clipId="probe-A" disabled={!bufs} onPress={() => listen('A')} />
        <ListenButton label="B 듣기" clipId="probe-B" disabled={!bufs} onPress={() => listen('B')} />
      </div>
      <Choices
        label="어느 쪽이 더 또렷해요?"
        value={clearer}
        onChange={setClearer}
        options={[
          { value: 'A', label: 'A가 더 또렷해요' },
          { value: 'same', label: '비슷해요' },
          { value: 'B', label: 'B가 더 또렷해요' },
        ]}
      />
      <Choices
        label="얼마나 확실해요?"
        value={confidence}
        onChange={setConfidence}
        options={[
          { value: 'sure', label: '확실해요' },
          { value: 'some', label: '조금' },
          { value: 'unsure', label: '잘 모르겠어요' },
        ]}
      />
      <Choices
        label="더 좋은 쪽도 같나요?"
        value={preferSame}
        onChange={setPreferSame}
        options={[
          { value: 'yes', label: '네' },
          { value: 'no', label: '아니요, 다른 쪽이 더 좋아요' },
          { value: 'unsure', label: '잘 모르겠어요' },
        ]}
      />
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
