// S3. 나의 청취 단서 (구성안 3.3절 S3, 6.4절)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { getLang, ko, tx, useLang } from '../../i18n';
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
  const lang = useLang(); // 언어가 바뀌면 문장을 다시 만든다
  const data = useMemo(() => buildReport(probe, events), [probe, events, lang]);
  const reveal = useMemo(() => buildRevealRows(probe), [probe, lang]);
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
        <h1>{tx('나의 청취 단서', 'My Listening Cues')}</h1>
        <div className="card card-tone lavender stack" style={{ gap: 8 }}>
          <p>
            {getLang() === 'en' ? (
              <>
                This page is not a score. It shows <strong>the trends in what you heard this time</strong>. In research, people listen to hundreds of
                sound pairs to estimate cues, but here you listened to only a few questions. Results may change on another day, and that is natural.
              </>
            ) : (
              <>
                이 화면은 점수가 아니라 <strong>이번에 들은 결과의 경향</strong>이에요. 연구에서는 소리를 수백 쌍 들어야 단서를 가늠하는데, 여기서는
                몇 문항만 들었어요. 다른 날 다시 해 보면 달라질 수 있고, 그것도 자연스러운 일이에요.
              </>
            )}
          </p>
          {data.hasResponses && (
            <p className="small">
              {tx(ko`지금까지 질문 ${data.counts.total}개에 답했어요`, `So far you answered ${data.counts.total} ${data.counts.total === 1 ? 'question' : 'questions'}`)}
              {data.counts.skipped > 0 ? tx(ko` (넘어간 질문 ${data.counts.skipped}개)`, ` (${data.counts.skipped} skipped)`) : ''}.
            </p>
          )}
        </div>
        {!storageAvailable() && <p className="small" role="status">{tx('이 기기에서는 기록이 남지 않아요. 창을 닫으면 사라져요.', 'Records are not kept on this device. They disappear when you close the window.')}</p>}
      </div>

      {!data.hasResponses && (
        <section className="card stack" aria-labelledby="rep-empty">
          <h2 id="rep-empty">{tx('아직 답한 질문이 없어요', "You haven't answered any questions yet")}</h2>
          <p>
            {tx(
              '합주실에서 곡을 들어 보고 잠깐 질문에 답하면, 여기에 내가 느낀 것·고른 것·말한 것이 나란히 모여요. 정답은 없어요.',
              'Listen to a song in the Ensemble Room and answer the Quick questions. Then what you felt, what you picked, and what you said will appear here side by side. There are no right answers.',
            )}
          </p>
          <div className="row">
            <Link to="/probe/set1" className="btn btn-primary btn-lg">{tx('잠깐 질문 하러 가기', 'Go to Quick questions')}</Link>
            <Link to="/room/hbd" className="btn btn-lg">{tx('합주실로', 'To the Ensemble Room')}</Link>
          </div>
        </section>
      )}

      {data.hasResponses && (
        <>
          <section className="stack" aria-labelledby="rep-cues">
            <h2 id="rep-cues">{tx('단서별로 나란히 보기', 'Side by side, by cue')}</h2>
            <p className="small muted">
              {tx(
                '점수나 순위는 없어요. "느낀 것"은 두 소리가 얼마나 다르게 느껴졌는지, "고른 것"은 어느 쪽을 더 또렷하다고 골랐는지, "말한 것"은 구별할 때 무엇에 기댔다고 답했는지예요.',
                'There are no scores or rankings. "What you felt" is how different the two sounds felt. "What you picked" is which one you picked as clearer. "What you said" is what you said you relied on to tell them apart.',
              )}
            </p>
            {data.ref.n === 0 && (
              <p className="small">
                {tx(
                  '원본끼리 비교한 질문이 없어서, 기준 없이 표시한 값만 보여 드려요.',
                  'There was no question comparing the original with itself, so we show your ratings without a baseline.',
                )}
              </p>
            )}
            {data.cues.map((c) => (
              <CueCard key={c.id} cue={c} revealed={revealed} refCaution={data.ref.caution} openRequest={openRequest} />
            ))}
            {data.bass.appeared > 0 && (
              <p className="card card-soft">
                {getLang() === 'en' ? (
                  <>
                    <strong>Bass</strong> (for reference only): you picked the sound with boosted bass as clearer {data.bass.chosen} of {data.bass.appeared}{' '}
                    times. The related instrument is the bass.
                  </>
                ) : (
                  <>
                    <strong>저음</strong> (참고로만 봐 주세요): 저음을 키운 소리를 {data.bass.appeared}번 중 {data.bass.chosen}번 "더 또렷해요"로
                    골랐어요. 관련된 악기는 베이스예요.
                  </>
                )}
              </p>
            )}
          </section>

          {data.sentences.filter((x) => x.kind !== 'log').length > 0 && (
            <section className="stack" aria-labelledby="rep-agree">
              <h2 id="rep-agree">{tx('함께 보면', 'Seen together')}</h2>
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
        <h2 id="rep-did">{tx('합주실에서 한 것', 'What you did in the Ensemble Room')} <span className="tag">{tx('추정', 'Estimate')}</span></h2>
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
            <p className="small muted">
              {tx('악기 이름으로만 말해요. 이것이 어떤 소리 단서 때문인지는 알 수 없어요.', "We describe this only by instrument. We can't tell which sound cue led to this.")}
            </p>
          </>
        ) : (
          <p className="muted">
            {tx(
              '아직 합주실 기록이 많지 않아요. 악기 그림을 눌러 혼자 들어 보면 여기에 나타나요.',
              "There aren't many Ensemble Room records yet. Press an instrument picture to hear it solo, and it will show up here.",
            )}
          </p>
        )}
      </section>

      {data.hasResponses && reflections.length > 0 && (
        <section className="stack" aria-labelledby="rep-say">
          <h2 id="rep-say">{tx('직접 적은 것', 'What you wrote')}</h2>
          {reflections.map((r) => (
            <div key={r.set} className="card card-soft">
              <ReflectionRevise reflection={r} />
            </div>
          ))}
        </section>
      )}

      {data.consistency.length > 0 && (
        <section className="stack" aria-labelledby="rep-consist">
          <h2 id="rep-consist">{tx('같은 소리를 다시 들었을 때', 'When you heard the same sounds again')}</h2>
          <p className="small muted">
            {tx(
              '같은 두 소리를 한 번 더 들었을 때 표시가 얼마나 비슷했는지 보여 드려요. 좋고 나쁨을 뜻하지 않아요.',
              'This shows how similar your ratings were when you heard the same two sounds once more. It does not mean good or bad.',
            )}
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
          <h2 id="rep-reveal">{tx('질문마다 바꾼 소리', 'What we changed in each question')}</h2>
          {revealed && reveal.length > 0 ? (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="rep-table">
                <caption className="sr-only">{tx('질문 번호별로 소리 A와 B에서 바뀐 것', 'What changed in sounds A and B, by question number')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{tx('질문', 'Question')}</th>
                    <th scope="col">{tx('소리 A/B에서 바뀐 것', 'What changed in sound A/B')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reveal.map((r) => (
                    <tr key={`${r.set}-${r.itemId}`}>
                      <td>{tx('세트', 'Set')} {r.set} · {r.n}</td>
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
              {tx(
                '어떤 소리를 바꿨는지는 세트를 끝낸 뒤에 알려 드려요. 미리 알면 답이 달라질 수 있어서예요.',
                "We'll tell you which sounds we changed after you finish a set, because knowing beforehand could change your answers.",
              )}
            </p>
          )}
        </section>
      )}

      <section className="stack" aria-labelledby="rep-profile">
        <h2 id="rep-profile">{tx('내 소리 설정', 'My sound settings')}</h2>
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
              <h3>{tx('설정을 이렇게 바꿨어요', 'How you changed your settings')}</h3>
              <ul className="rep-list" style={{ marginTop: 6 }}>
                {hist.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          <div>
            <Link to="/settings" className="btn btn-sm"><Icon name="sliders" size={20} /> {tx('소리 맞추기 다시 하기', 'Redo Sound setup')}</Link>
          </div>
        </div>
      </section>

      {data.hasResponses && (
        <section className="card card-tone mint stack" aria-labelledby="rep-next" style={{ gap: 10 }}>
          <h2 id="rep-next">{tx('다음에 해 볼 것', 'Try next')}</h2>
          <p>{data.next.text}</p>
          <div>
            {data.next.kind === 'shaky' && data.next.cue ? (
              <button type="button" className="btn btn-primary" onClick={() => goCue(data.next.cue!)}>
                {tx('그 카드로 가서 다시 듣기', 'Go to that card and listen again')}
              </button>
            ) : (
              <Link to={data.next.href ?? '/probe/set2'} className="btn btn-primary">
                {data.next.kind === 'differ' ? tx('합주실로 가기', 'Go to the Ensemble Room') : tx('세트 2 시작하기', 'Start Set 2')}
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="stack" aria-labelledby="rep-actions">
        <h2 id="rep-actions">{tx('이어서 하기', 'Keep going')}</h2>
        <div className="row">
          <Link to={`/probe/set${nextSet}`} className="btn btn-lg">
            <Icon name="refresh" /> {tx(ko`다시 해 보기 (세트 ${nextSet})`, `Try again (Set ${nextSet})`)}
          </Link>
          <Link to="/room/hbd" className="btn btn-lg">{tx('합주실로', 'To the Ensemble Room')}</Link>
        </div>
        <ExportButtons />
      </section>

      <section className="card stack" aria-labelledby="rep-how">
        <details className="rep-details">
          <summary id="rep-how">{tx('이 결과는 어떻게 만들었나요?', 'How were these results made?')}</summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="small muted">
              {tx(
                ko`아래 기준값(예: ${RULES.feelSome}, ${RULES.feelBig}, ${RULES.shaky})은 모두 설계하면서 정한 값이에요. 연구로 확인된 값은 아니에요.`,
                `The cutoff values below (e.g., ${RULES.feelSome}, ${RULES.feelBig}, ${RULES.shaky}) were all chosen while designing this app. They have not been confirmed by research.`,
              )}
            </p>
            <h3>{tx('규칙', 'Rules')}</h3>
            <ul className="rep-list">
              {RULE_TEXT.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            <h3>{tx('한계', 'Limits')}</h3>
            <ul className="rep-list">
              {LIMIT_TEXT.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </details>
      </section>
    </main>
  );
}
