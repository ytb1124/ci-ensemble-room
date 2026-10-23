import { useEffect, useState } from 'react';
import { SoundOnButton } from '../../components/SoundGate';
import { Icon } from '../../components/ui/Icon';
import { engine, useEngineState } from '../../audio/useEngine';
import { getProbeClip, type ClipId } from '../../audio/probeAudio';
import { FEEL_WORD, type CueSummary } from '../../store/reportRules';

/** 한 단서의 원본 vs 편집본 A/B 다시 듣기. 세트를 끝내기 전에는 어느 쪽이 바뀐 소리인지 알려 주지 않는다 */
function Replay({ cue, revealed }: { cue: CueSummary; revealed: boolean }) {
  const st = useEngineState();
  const [busy, setBusy] = useState<string | null>(null);
  // 공개 전에는 단서마다 정해진 순서로 "소리 1/2"만 보여 준다
  const swap = !revealed && (cue.id.charCodeAt(0) + cue.id.length) % 2 === 0;
  const parts: { which: 'orig' | 'edit'; clip: ClipId; label: string }[] = [
    { which: 'orig', clip: 'orig', label: revealed ? '원본 듣기' : '' },
    { which: 'edit', clip: cue.aCue, label: revealed ? '바꾼 소리 듣기' : '' },
  ];
  const ordered = swap ? [parts[1], parts[0]] : parts;

  useEffect(
    () => () => {
      if (engine.store.get().clip?.startsWith('rep_')) engine.stopClip();
    },
    [],
  );

  if (!st.unlocked) return <SoundOnButton label="소리 켜고 들어 보기" />;

  const play = async (p: (typeof parts)[number]) => {
    const id = `rep_${cue.id}_${p.which}`;
    if (st.clip === id) {
      engine.stopClip();
      return;
    }
    if (!engine.ctx) return;
    setBusy(id);
    try {
      const buf = await getProbeClip(engine.ctx, p.clip);
      engine.playClip(buf, id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="row" role="group" aria-label={`${cue.label} 다시 들어 보기`}>
      {ordered.map((p, i) => {
        const id = `rep_${cue.id}_${p.which}`;
        const playing = st.clip === id;
        const text = revealed ? p.label : `소리 ${i + 1} 듣기`;
        return (
          <button key={id} type="button" className="btn" aria-pressed={playing} disabled={busy === id} onClick={() => void play(p)}>
            <Icon name={playing ? 'pause' : 'play'} size={20} />
            {busy === id ? '준비 중…' : playing ? `${text} (멈추기)` : text}
          </button>
        );
      })}
    </div>
  );
}

export function CueCard({
  cue,
  revealed,
  refCaution,
  openRequest,
}: {
  cue: CueSummary;
  revealed: boolean;
  refCaution: boolean;
  /** "다음에 해 볼 것"에서 이 카드를 열어 달라는 요청 */
  openRequest: { id: string; n: number } | null;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest && openRequest.id === cue.id) setOpen(true);
  }, [openRequest, cue.id]);
  const { feel, pick, say } = cue;
  const headingId = `rep-cue-${cue.id}`;
  return (
    <section className="card card-soft stack" aria-labelledby={headingId} id={headingId + '-card'} tabIndex={-1}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 id={headingId}>{cue.label}</h3>
        <div className="rep-tags">
          {feel.shaky && <span className="tag">아직 흔들려요</span>}
          {feel.once && <span className="tag">한 번만 들었어요</span>}
        </div>
      </div>
      {cue.instrument && <p className="small muted">참고로 관련된 악기: {cue.instrument}</p>}

      <div className="rep-cols">
        <div className="rep-col">
          <h4>느낀 것</h4>
          {feel.level ? (
            <>
              <p className="rep-word">{FEEL_WORD[feel.level]}</p>
              <p className="small muted">{feel.n}번 평정했어요</p>
              {refCaution && <p className="small">차이가 없을 때도 다르다고 느끼는 편이에요. 값을 조심해서 보세요.</p>}
            </>
          ) : (
            <p className="muted">아직 평정이 없어요</p>
          )}
        </div>
        <div className="rep-col">
          <h4>고른 것</h4>
          {pick.appeared ? (
            <>
              <p className="rep-word">
                {pick.appeared}번 중 {pick.chosen}번
              </p>
              <p className="small">"더 또렷해요"로 골랐어요</p>
              {pick.chosen > 0 && (
                <p className="small">
                  {pick.sure > 0 && <span className="rep-strong">확실해요 {pick.sure}번 </span>}
                  {pick.some > 0 && <span>조금 {pick.some}번 </span>}
                  {pick.unsure > 0 && <span className="rep-faint">잘 모르겠어요 {pick.unsure}번</span>}
                </p>
              )}
              {pick.differentGood > 0 && <p className="small">또렷함과 좋음이 달랐어요</p>}
            </>
          ) : (
            <p className="muted">이 단서는 아직 고르지 않았어요</p>
          )}
        </div>
        <div className="rep-col">
          <h4>말한 것</h4>
          {say.chipCount > 0 ? (
            <p className="rep-word">칩 {say.chipCount}번</p>
          ) : (
            <p className="muted">칩으로 고르지 않았어요</p>
          )}
          {say.notes.slice(0, 2).map((n, i) => (
            <p key={i} className="rep-quote small">"{n}"</p>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div>
          <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name="headphones" size={20} /> 다시 들어 보기
          </button>
        </div>
        {open && <Replay cue={cue} revealed={revealed} />}
      </div>
    </section>
  );
}
