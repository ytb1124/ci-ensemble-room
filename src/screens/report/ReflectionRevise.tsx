import { useState } from 'react';
import { getLang, tx } from '../../i18n';
import { reviseReflection } from '../../store/probe';
import { diffRevision, reflectionAsText, type TextSeg } from '../../store/reportRules';
import type { Reflection } from '../../types';

function Segs({ segs }: { segs: TextSeg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.bold ? <strong key={i} className="rep-strong">{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

/** 설명 고쳐 쓰기(6.3절). 처음 설명과 고친 설명을 나란히 보여 주고 평가하지 않는다 */
export function ReflectionRevise({ reflection }: { reflection: Reflection }) {
  const original = reflectionAsText(reflection);
  const hasText = reflection.text.trim().length > 0;
  const [mode, setMode] = useState<'idle' | 'edit' | 'kept'>('idle');
  const [draft, setDraft] = useState(reflection.revised ?? '');
  const revised = reflection.revised;

  if (!original && revised === null) return null;
  const diff = revised ? diffRevision(original, revised) : null;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <h3>{tx(`세트 ${reflection.set}에서 적어 주신 설명`, `What you wrote in Set ${reflection.set}`)}</h3>
      {revised && diff ? (
        <div className="rep-pair">
          <div className="rep-col">
            <h4>{tx('처음', 'First')}</h4>
            <p className="rep-quote"><Segs segs={diff.orig} /></p>
          </div>
          <div className="rep-col">
            <h4>{tx('고친 설명', 'Revised')}</h4>
            <p className="rep-quote"><Segs segs={diff.rev} /></p>
          </div>
        </div>
      ) : (
        <p className="rep-quote">{original ? `"${original}"` : tx('적은 설명이 없어요.', "You didn't write anything.")}</p>
      )}
      {revised && <p className="small muted">{tx('바뀐 단서 낱말은 굵게 표시했어요. 어느 쪽이 맞다는 뜻은 아니에요.', "Cue words that changed are in bold. This doesn't mean either one is right.")}</p>}

      {mode === 'idle' && !revised && (
        <>
          <p>
            {getLang() === 'en' ? (
              <>
                {hasText ? 'This is what you wrote earlier.' : 'These are the chips you picked earlier.'} You just saw which sound was changed in each
                question. Is there anything you want to change or add now?
              </>
            ) : (
              <>
                {hasText ? '아까 이렇게 적었어요.' : '아까 이 칩을 골랐어요.'} 방금 질문마다 바꾼 소리를 확인했어요. 지금 보니
                고치거나 덧붙이고 싶은 곳이 있나요?
              </>
            )}
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode('kept')}>{tx('그대로 둘게요', 'Keep it')}</button>
            <button type="button" className="btn btn-primary" onClick={() => setMode('edit')}>{tx('고쳐 쓸게요', 'Revise it')}</button>
          </div>
        </>
      )}
      {mode === 'idle' && revised && (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setMode('edit')}>{tx('다시 고치기', 'Revise again')}</button>
        </div>
      )}
      {mode === 'kept' && (
        <p role="status" className="small">{tx('그대로 두었어요. 마음이 바뀌면 언제든 고칠 수 있어요.', 'Kept as it is. If you change your mind, you can revise it any time.')}</p>
      )}
      {mode === 'edit' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            reviseReflection(reflection.set, draft.trim() || null);
            setMode('idle');
          }}
        >
          <label htmlFor={`rep-rev-${reflection.set}`} style={{ fontWeight: 600 }}>{tx('고친 설명', 'Revised')}</label>
          <textarea
            id={`rep-rev-${reflection.set}`}
            className="input rep-textarea"
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tx('예: 시작 소리보다 밝기를 더 느꼈던 것 같아요', 'e.g., I think I noticed brightness more than note start')}
          />
          <div className="row">
            <button type="submit" className="btn btn-primary">{tx('저장', 'Save')}</button>
            <button type="button" className="btn" onClick={() => setMode('idle')}>{tx('취소', 'Cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
