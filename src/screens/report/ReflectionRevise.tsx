import { useState } from 'react';
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
      <h3>세트 {reflection.set}에서 적어 주신 설명</h3>
      {revised && diff ? (
        <div className="rep-pair">
          <div className="rep-col">
            <h4>처음</h4>
            <p className="rep-quote"><Segs segs={diff.orig} /></p>
          </div>
          <div className="rep-col">
            <h4>고친 설명</h4>
            <p className="rep-quote"><Segs segs={diff.rev} /></p>
          </div>
        </div>
      ) : (
        <p className="rep-quote">{original ? `"${original}"` : '적은 설명이 없어요.'}</p>
      )}
      {revised && <p className="small muted">바뀐 단서 낱말은 굵게 표시했어요. 어느 쪽이 맞다는 뜻은 아니에요.</p>}

      {mode === 'idle' && !revised && (
        <>
          <p>
            {hasText ? '아까 이렇게 적었어요.' : '아까 이 칩을 골랐어요.'} 방금 질문마다 바꾼 소리를 확인했어요. 지금 보니
            고치거나 덧붙이고 싶은 곳이 있나요?
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode('kept')}>그대로 둘게요</button>
            <button type="button" className="btn btn-primary" onClick={() => setMode('edit')}>고쳐 쓸게요</button>
          </div>
        </>
      )}
      {mode === 'idle' && revised && (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setMode('edit')}>다시 고치기</button>
        </div>
      )}
      {mode === 'kept' && (
        <p role="status" className="small">그대로 두었어요. 마음이 바뀌면 언제든 고칠 수 있어요.</p>
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
          <label htmlFor={`rep-rev-${reflection.set}`} style={{ fontWeight: 600 }}>고친 설명</label>
          <textarea
            id={`rep-rev-${reflection.set}`}
            className="input rep-textarea"
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 시작 소리보다 밝기를 더 느꼈던 것 같아요"
          />
          <div className="row">
            <button type="submit" className="btn btn-primary">저장</button>
            <button type="button" className="btn" onClick={() => setMode('idle')}>취소</button>
          </div>
        </form>
      )}
    </div>
  );
}
