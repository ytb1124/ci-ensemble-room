import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { engine } from '../../audio/engine';
import { buildSet } from '../../config/probes';
import { addReflection, completeSet, markPracticed, probeStore } from '../../store/probe';
import type { CueId, ProbeItem } from '../../types';
import ProbeA from './ProbeA';
import ProbeB from './ProbeB';
import ProbeIntro from './ProbeIntro';
import Reflection from './Reflection';
import { clearSession, loadSession, makeRand, saveSession, type ProbeSession } from './probeShared';

function createSession(set: 1 | 2): ProbeSession {
  let avoid: CueId | undefined;
  if (set === 2) {
    const rep = probeStore.get().responses.find((r) => r.set === 1 && r.kind === 'A' && r.isRepeat);
    if (rep && rep.kind === 'A' && rep.cue !== 'ref') avoid = rep.cue;
  }
  const items = buildSet(set, avoid);
  const rand: ProbeSession['rand'] = {};
  items.forEach((it) => (rand[it.id] = makeRand()));
  return { set, items, rand, practiceRand: makeRand(), index: 0, stage: 'intro' };
}

export default function Probe() {
  const { set: param } = useParams();
  const set: 1 | 2 = param === 'set2' ? 2 : 1;
  const nav = useNavigate();
  const [session, setSession] = useState<ProbeSession>(() => loadSession(set) ?? createSession(set));
  const [confirmExit, setConfirmExit] = useState(false);

  // 라우트의 세트가 바뀌면 새로 시작
  useEffect(() => {
    if (session.set !== set) setSession(loadSession(set) ?? createSession(set));
  }, [set, session.set]);
  useEffect(() => {
    if (session.stage !== 'done') saveSession(session);
  }, [session]);
  useEffect(() => () => engine.stopClip(), []);

  const patch = (p: Partial<ProbeSession>) => setSession((s) => ({ ...s, ...p }));
  const total = session.items.length;
  const intro = session.stage === 'intro';
  const afterIntro = () => patch({ stage: probeStore.get().practiced ? 'items' : 'practice' });

  const practiceItem = useMemo<ProbeItem>(() => ({ kind: 'A', id: 'practice', cue: 'bright' }), []);

  const next = () => {
    if (session.index + 1 >= total) patch({ stage: 'reflect' });
    else patch({ index: session.index + 1 });
  };

  const exit = (
    <div className="probe-exit">
      {confirmExit ? (
        <>
          <span>여기서 그만할까요? 지금까지 한 답은 남아요.</span>
          <button type="button" className="btn btn-sm" onClick={() => setConfirmExit(false)}>계속할게요</button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              engine.stopClip();
              nav('/room/hbd');
            }}
          >
            그만하고 나가기
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmExit(true)}>그만하고 나가기</button>
      )}
    </div>
  );

  if (session.stage === 'done') {
    return (
      <main className="page page-narrow probe-page">
        <div className="stack-lg">
          <h1 style={{ margin: 0, fontSize: 24 }}>세트 {set}을 마쳤어요</h1>
          <p className="lead" style={{ margin: 0 }}>수고하셨어요. 어떤 소리를 바꿨는지는 리포트에서 알려 드려요.</p>
          <div className="stack">
            <Link to="/report" className="btn btn-lg btn-primary">나의 청취 단서 보기</Link>
            {set === 1 && (
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => {
                  clearSession(2);
                  nav('/probe/set2');
                }}
              >
                이어서 한 번 더 (세트 2)
              </button>
            )}
            <Link to="/room/hbd" className="btn btn-lg">합주실로</Link>
          </div>
        </div>
      </main>
    );
  }

  if (intro) {
    return (
      <>
        <ProbeIntro onDone={afterIntro} />
      </>
    );
  }

  const item = session.items[session.index];
  return (
    <main className="page page-narrow probe-page">
      <div className="stack-lg">
        {exit}
        {session.stage === 'practice' && (
          <ProbeA
            key="practice"
            set={set}
            item={practiceItem as Extract<ProbeItem, { kind: 'A' }>}
            rand={session.practiceRand}
            index={0}
            total={1}
            practice
            onNext={() => {
              markPracticed();
              patch({ stage: 'items' });
            }}
          />
        )}
        {session.stage === 'items' && item && item.kind === 'A' && (
          <ProbeA key={item.id} set={set} item={item} rand={session.rand[item.id]} index={session.index} total={total} onNext={next} />
        )}
        {session.stage === 'items' && item && item.kind === 'B' && (
          <ProbeB key={item.id} set={set} item={item} rand={session.rand[item.id]} index={session.index} total={total} onNext={next} />
        )}
        {session.stage === 'reflect' && (
          <Reflection
            onSubmit={(chips, text) => {
              addReflection({ set, chips, text, revised: null, at: new Date().toISOString() });
              completeSet(set);
              clearSession(set);
              patch({ stage: 'done' });
            }}
          />
        )}
      </div>
    </main>
  );
}
