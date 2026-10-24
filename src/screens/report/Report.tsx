// S3. 나의 청취 단서 (구성안 3.3절 S3, 6.4절)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { useEngineState } from '../../audio/useEngine';
import { useLog } from '../../store/log';
import { useProbeState } from '../../store/probe';
import { useProfile } from '../../store/profile';
import { recordSnapshot } from '../../store/exportData';
import {
  LIMIT_TEXT,
  RULE_TEXT,
  RULES,
  buildReport,
  buildRevealRows,
  historyLines,
  profileLines,
} from '../../store/reportRules';
import { storageAvailable } from '../../store/storage';
import { CueCard } from './CueCard';
import { ExportButtons } from './ExportButtons';
import { ReflectionRevise } from './ReflectionRevise';
import './report.css';

export default function Report() {
  const probe = useProbeState();
  const events = useLog();
  const profile = useProfile();
  useEngineState(); // 소리 켜짐 상태가 바뀌면 카드가 다시 그려지도록
  const data = useMemo(() => buildReport(probe, events), [probe, events]);
  const reveal = useMemo(() => buildRevealRows(probe), [probe]);
  const [openRequest, setOpenRequest] = useState<{ id: string; n: number } | null>(null);

  const total = probe.responses.length;
  useEffect(() => {
    recordSnapshot(probe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const revealed = probe.completedSets.length > 0;
  const nextSet: 1 | 2 = probe.completedSets.includes(1) && !probe.completedSets.includes(2) ? 2 : 1;
  const reflections = probe.reflections.filter((r) => probe.completedSets.includes(r.set));
  const hist = historyLines(profile);

  const goCue = (id: string) => {
    setOpenRequest({ id, n: Date.now() });
    const el = document.getElementById(`rep-cue-${id}-card`);
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  return (
    <main className="page page-narrow stack-lg">
      <div className="stack">
        <h1>나의 청취 단서</h1>
        <div className="card card-tone lavender stack" style={{ gap: 8 }}>
          <p>
            이 화면은 점수가 아니라 <strong>이번에 들은 결과의 경향</strong>이에요. 연구에서는 소리를 수백 쌍 들어야 단서를 가늠하는데, 여기서는
            몇 문항만 들었어요. 다른 날 다시 해 보면 달라질 수 있고, 그것도 자연스러운 일이에요.
          </p>
          {data.hasResponses && (
            <p className="small">
              지금까지 질문 {data.counts.total}개에 답했어요
              {data.counts.skipped > 0 ? ` (넘어간 질문 ${data.counts.skipped}개)` : ''}.
            </p>
          )}
        </div>
        {!storageAvailable() && <p className="small" role="status">이 기기에서는 기록이 남지 않아요. 창을 닫으면 사라져요.</p>}
      </div>

      {!data.hasResponses && (
        <section className="card stack" aria-labelledby="rep-empty">
          <h2 id="rep-empty">아직 답한 질문이 없어요</h2>
          <p>
            합주실에서 곡을 들어 보고 잠깐 질문에 답하면, 여기에 내가 느낀 것·고른 것·말한 것이 나란히 모여요. 정답은 없어요.
          </p>
          <div className="row">
            <Link to="/probe/set1" className="btn btn-primary btn-lg">잠깐 질문 하러 가기</Link>
            <Link to="/room/hbd" className="btn btn-lg">합주실로</Link>
          </div>
        </section>
      )}

      {data.hasResponses && (
        <>
          <section className="stack" aria-labelledby="rep-cues">
            <h2 id="rep-cues">단서별로 나란히 보기</h2>
            <p className="small muted">
              점수나 순위는 없어요. "느낀 것"은 두 소리가 얼마나 다르게 느껴졌는지, "고른 것"은 어느 쪽을 더 또렷하다고 골랐는지, "말한 것"은 구별할 때
              무엇에 기댔다고 답했는지예요.
            </p>
            {data.ref.n === 0 && (
              <p className="small">원본끼리 비교한 질문이 없어서, 기준 없이 표시한 값만 보여 드려요.</p>
            )}
            {data.cues.map((c) => (
              <CueCard key={c.id} cue={c} revealed={revealed} refCaution={data.ref.caution} openRequest={openRequest} />
            ))}
            {data.bass.appeared > 0 && (
              <p className="card card-soft">
                <strong>저음</strong> (참고로만 봐 주세요): 저음을 키운 소리를 {data.bass.appeared}번 중 {data.bass.chosen}번 "더 또렷해요"로
                골랐어요. 관련된 악기는 베이스예요.
              </p>
            )}
          </section>

          {data.sentences.filter((x) => x.kind !== 'log').length > 0 && (
            <section className="stack" aria-labelledby="rep-agree">
              <h2 id="rep-agree">함께 보면</h2>
              {data.sentences.filter((x) => x.kind !== 'log').map((s, i) => (
                <p key={i} className="rep-sentence">
                  <strong>{s.lead}</strong>
                  {s.rest}
                </p>
              ))}
            </section>
          )}
        </>
      )}

      <section className="stack" aria-labelledby="rep-did">
        <h2 id="rep-did">합주실에서 한 것 <span className="tag">추정</span></h2>
        {data.log.any ? (
          <>
            <ul className="rep-list">
              {data.log.parts.map((p, i) => (
                <li key={i}>
                  <strong>{p.lead}</strong>
                  {p.rest}
                </li>
              ))}
            </ul>
            <p className="small muted">악기 이름으로만 말해요. 이것이 어떤 소리 단서 때문인지는 알 수 없어요.</p>
          </>
        ) : (
          <p className="muted">아직 합주실 기록이 많지 않아요. 악기 그림을 눌러 혼자 들어 보면 여기에 나타나요.</p>
        )}
      </section>

      {data.hasResponses && reflections.length > 0 && (
        <section className="stack" aria-labelledby="rep-say">
          <h2 id="rep-say">직접 적은 것</h2>
          {reflections.map((r) => (
            <div key={r.set} className="card card-soft">
              <ReflectionRevise reflection={r} />
            </div>
          ))}
        </section>
      )}

      {data.consistency.length > 0 && (
        <section className="stack" aria-labelledby="rep-consist">
          <h2 id="rep-consist">같은 소리를 다시 들었을 때</h2>
          <p className="small muted">
            같은 두 소리를 한 번 더 들었을 때 표시가 얼마나 비슷했는지 보여 드려요. 좋고 나쁨을 뜻하지 않아요.
          </p>
          <ul className="rep-list">
            {data.consistency.map((c, i) => (
              <li key={i}>
                <strong>{c.label}</strong>: {c.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.hasResponses && (
        <section className="stack" aria-labelledby="rep-reveal">
          <h2 id="rep-reveal">질문마다 바꾼 소리</h2>
          {revealed && reveal.length > 0 ? (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="rep-table">
                <caption className="sr-only">질문 번호별로 소리 A와 B에서 바뀐 것</caption>
                <thead>
                  <tr>
                    <th scope="col">질문</th>
                    <th scope="col">소리 A/B에서 바뀐 것</th>
                  </tr>
                </thead>
                <tbody>
                  {reveal.map((r) => (
                    <tr key={`${r.set}-${r.itemId}`}>
                      <td>세트 {r.set} · {r.n}</td>
                      <td>
                        {r.text}
                        {r.note && <div className="small muted">{r.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card card-soft">
              어떤 소리를 바꿨는지는 세트를 끝낸 뒤에 알려 드려요. 미리 알면 답이 달라질 수 있어서예요.
            </p>
          )}
        </section>
      )}

      <section className="stack" aria-labelledby="rep-profile">
        <h2 id="rep-profile">내 소리 설정</h2>
        <div className="card card-soft stack">
          <dl className="rep-profile">
            {profileLines(profile).map((l) => (
              <div key={l.label} style={{ display: 'contents' }}>
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
          {hist.length > 0 && (
            <div>
              <h3>설정을 이렇게 바꿨어요</h3>
              <ul className="rep-list" style={{ marginTop: 6 }}>
                {hist.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          <div>
            <Link to="/settings" className="btn btn-sm"><Icon name="sliders" size={20} /> 소리 맞추기 다시 하기</Link>
          </div>
        </div>
      </section>

      {data.hasResponses && (
        <section className="card card-tone mint stack" aria-labelledby="rep-next" style={{ gap: 10 }}>
          <h2 id="rep-next">다음에 해 볼 것</h2>
          <p>{data.next.text}</p>
          <div>
            {data.next.kind === 'shaky' && data.next.cue ? (
              <button type="button" className="btn btn-primary" onClick={() => goCue(data.next.cue!)}>
                그 카드로 가서 다시 듣기
              </button>
            ) : (
              <Link to={data.next.href ?? '/probe/set2'} className="btn btn-primary">
                {data.next.kind === 'differ' ? '합주실로 가기' : '세트 2 시작하기'}
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="stack" aria-labelledby="rep-actions">
        <h2 id="rep-actions">이어서 하기</h2>
        <div className="row">
          <Link to={`/probe/set${nextSet}`} className="btn btn-lg">
            <Icon name="refresh" /> 다시 해 보기 (세트 {nextSet})
          </Link>
          <Link to="/room/hbd" className="btn btn-lg">합주실로</Link>
        </div>
        <ExportButtons />
      </section>

      <section className="card stack" aria-labelledby="rep-how">
        <details className="rep-details">
          <summary id="rep-how">이 결과는 어떻게 만들었나요?</summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="small muted">
              아래 기준값(예: {RULES.feelSome}, {RULES.feelBig}, {RULES.shaky})은 모두 설계하면서 정한 값이에요. 연구로 확인된 값은 아니에요.
            </p>
            <h3>규칙</h3>
            <ul className="rep-list">
              {RULE_TEXT.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            <h3>한계</h3>
            <ul className="rep-list">
              {LIMIT_TEXT.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </details>
      </section>
    </main>
  );
}
