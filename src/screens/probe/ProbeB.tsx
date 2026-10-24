import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { emphClip } from '../../audio/probeAudio';
import { tx } from '../../i18n';
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
  const why = !heard
    ? tx('소리 A나 B를 한 번 들어 주세요.', 'Please listen to sound A or B once.')
    : tx('"어느 쪽이 더 또렷해요?"에 답해 주세요.', 'Please answer "Which one is clearer?"');

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
      <p className="probe-q">{tx('두 소리를 들어 보세요. 어느 쪽이 나에게 더 또렷하게 들리나요?', 'Listen to the two sounds. Which one sounds clearer to you?')}</p>
      {error && <p role="alert" style={{ margin: 0 }}>{tx('소리를 준비하지 못했어요. [넘어가기]를 눌러 주세요.', "We couldn't get the sounds ready. Please press [Skip].")}</p>}
      {!bufs && !error && <p style={{ margin: 0 }} role="status">{tx('소리를 준비하고 있어요…', 'Getting the sounds ready…')}</p>}
      <div className="probe-listen-row">
        <ListenButton label={tx('A 듣기', 'Play A')} clipId="probe-A" disabled={!bufs} onPress={() => listen('A')} />
        <ListenButton label={tx('B 듣기', 'Play B')} clipId="probe-B" disabled={!bufs} onPress={() => listen('B')} />
      </div>
      <Choices
        label={tx('어느 쪽이 더 또렷해요?', 'Which one is clearer?')}
        value={clearer}
        onChange={setClearer}
        options={[
          { value: 'A', label: tx('A가 더 또렷해요', 'A is clearer') },
          { value: 'same', label: tx('비슷해요', 'About the same') },
          { value: 'B', label: tx('B가 더 또렷해요', 'B is clearer') },
        ]}
      />
      <Choices
        label={tx('얼마나 확실해요?', 'How sure are you?')}
        value={confidence}
        onChange={setConfidence}
        options={[
          { value: 'sure', label: tx('확실해요', 'Sure') },
          { value: 'some', label: tx('조금', 'Somewhat') },
          { value: 'unsure', label: tx('잘 모르겠어요', 'Not sure') },
        ]}
      />
      <Choices
        label={tx('더 좋게 들리는 쪽도 같은가요?', 'Is the clearer one also the one you like better?')}
        value={preferSame}
        onChange={setPreferSame}
        options={[
          { value: 'yes', label: tx('네', 'Yes') },
          { value: 'no', label: tx('아니요, 다른 쪽이 더 좋아요', 'No, I like the other one better') },
          { value: 'unsure', label: tx('잘 모르겠어요', 'Not sure') },
        ]}
      />
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
