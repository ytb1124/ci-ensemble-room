// 연구 참여: 동의 + 배경 설문. 참여 중이면 배경 설문만 고친다.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/controls';
import {
  RETENTION_TEXT, declineResearch, joinResearch, researchEnabled, updateSurvey, useResearch, type Survey,
} from '../store/research';

type Q = { key: keyof Survey; title: string; options: [string, string][] };

// 값(영문 코드)은 서버에 그대로 남는다. 글자를 바꿔도 코드는 바꾸지 않는다
const QUESTIONS: Q[] = [
  { key: 'ageGroup', title: '나이대', options: [['u19', '10대 이하'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60p', '60대 이상']] },
  {
    key: 'wearing',
    title: '어떻게 듣고 있나요?',
    options: [
      ['bilateral', '양쪽 인공와우'],
      ['unilateral', '한쪽 인공와우'],
      ['bimodal', '인공와우 + 다른 쪽 보청기'],
      ['ssd', '인공와우 + 다른 쪽은 잘 들림'],
      ['unknown', '잘 모르겠어요'],
    ],
  },
  { key: 'ciYears', title: '인공와우를 쓴 지', options: [['lt1', '1년 안 됨'], ['1to3', '1–3년'], ['3to10', '3–10년'], ['gt10', '10년 넘게']] },
  {
    key: 'onset',
    title: '청력이 약해진 때',
    options: [['prelingual', '태어날 때부터 또는 말을 배우기 전'], ['child', '말을 배운 뒤, 어릴 때'], ['adult', '어른이 된 뒤'], ['unknown', '잘 모르겠어요']],
  },
  { key: 'maker', title: '인공와우 회사', options: [['cochlear', '코클리어'], ['medel', '메드엘'], ['ab', '어드밴스드 바이오닉스'], ['oticon', '오티콘'], ['unknown', '잘 모르겠어요']] },
  { key: 'music', title: '음악 경험', options: [['none', '배운 적 없어요'], ['some', '조금 배웠어요'], ['regular', '꾸준히 하거나 했어요']] },
  { key: 'route', title: '이 앱을 주로 듣는 방법', options: [['direct', '직접 연결(블루투스·선)'], ['speaker', '스피커'], ['headphones', '헤드폰']] },
];

export default function Join() {
  const rs = useResearch();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const joined = rs.status === 'joined';
  const [survey, setSurvey] = useState<Survey>(rs.survey);
  const [agreeData, setAgreeData] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!researchEnabled) {
    return (
      <main className="page page-narrow stack-lg">
        <h1>연구 참여</h1>
        <p>아직 연구 서버가 연결되지 않았어요. 앱은 그대로 쓸 수 있어요.</p>
        <Link to={next} className="btn">돌아가기</Link>
      </main>
    );
  }

  const pick = (key: keyof Survey, v: string) => {
    setSaved(false);
    setSurvey((s) => ({ ...s, [key]: s[key] === v ? undefined : v }));
  };

  const submit = async () => {
    setBusy(true);
    const ok = joined ? await updateSurvey(survey) : await joinResearch(survey);
    setBusy(false);
    if (!ok) return;
    if (joined) setSaved(true);
    else nav(next);
  };

  return (
    <main className="page page-narrow stack-lg">
      <header className="stack">
        <h1 style={{ margin: 0 }}>{joined ? '배경 질문 고치기' : '연구에 함께해 주실래요?'}</h1>
        {!joined && (
          <p className="lead" style={{ margin: 0 }}>
            인공와우로 음악을 듣는 사람마다 무엇이 잘 들리는지 알아보려고 해요. 참여하지 않아도 앱은 똑같이 쓸 수 있어요.
          </p>
        )}
      </header>

      {!joined && (
        <section className="card stack" aria-labelledby="join-what">
          <h2 id="join-what" style={{ margin: 0 }}>무엇을 모으나요?</h2>
          <ul className="stack" style={{ margin: 0, paddingLeft: 20, gap: 6 }}>
            <li>처음 설정에서 고른 소리(크기, 소리 색, 저음 도움 등)</li>
            <li>합주실에서 누른 기록(골라 듣기, 빼고 듣기, 크기 조절)</li>
            <li>잠깐 질문에 고른 답</li>
            <li>아래 배경 질문의 답(인공와우 사용 정보 포함)</li>
          </ul>
          <p style={{ margin: 0 }}>참여하기 전에 이 기기에 쌓인 기록도 함께 보내요.</p>
          <h2 style={{ margin: 0 }}>모으지 않는 것</h2>
          <p style={{ margin: 0 }}>이름, 연락처, 이메일, 목소리 녹음은 받지 않아요. 무작위 번호로만 구분해요.</p>
          <h2 style={{ margin: 0 }}>보관과 그만두기</h2>
          <p style={{ margin: 0 }}>
            연구팀 서버에 보관하고, 연구에만 써요. {RETENTION_TEXT} 언제든 [설정 → 연구 참여]에서 그만두면 보낸 기록이 모두 지워져요.
          </p>
        </section>
      )}

      <section className="card stack-lg" aria-labelledby="join-survey">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="join-survey" style={{ margin: 0 }}>배경 질문 (1분)</h2>
          <p className="small muted" style={{ margin: 0 }}>답하고 싶지 않은 질문은 건너뛰어도 돼요. 다시 누르면 선택이 풀려요.</p>
        </div>
        {QUESTIONS.map((q) => (
          <div className="stack" key={q.key} role="group" aria-label={q.title} style={{ gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>{q.title}</h3>
            <div className="row">
              {q.options.map(([v, label]) => (
                <Chip key={v} pressed={survey[q.key] === v} onClick={() => pick(q.key, v)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!joined && (
        <section className="card card-soft stack" aria-label="동의">
          <label className="join-check">
            <input type="checkbox" checked={agreeData} onChange={(e) => setAgreeData(e.target.checked)} />
            <span>[필수] 위 기록을 연구에 쓰는 데 동의해요.</span>
          </label>
          <label className="join-check">
            <input type="checkbox" checked={agreeHealth} onChange={(e) => setAgreeHealth(e.target.checked)} />
            <span>[필수] 인공와우 사용 정보는 건강 정보예요. 이 정보를 모으고 쓰는 데 따로 동의해요.</span>
          </label>
        </section>
      )}

      {rs.error && (
        <p role="alert" style={{ color: 'var(--error)', fontWeight: 600, margin: 0 }}>
          보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. ({rs.error})
        </p>
      )}
      {saved && <p role="status" style={{ fontWeight: 600, margin: 0 }}>저장했어요.</p>}

      <div className="stack">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={busy || (!joined && !(agreeData && agreeHealth))}
          onClick={() => void submit()}
        >
          {busy ? '보내는 중…' : joined ? '저장하기' : '동의하고 참여하기'}
          {!busy && !joined && <Icon name="chevronRight" />}
        </button>
        {joined ? (
          <Link to="/settings" className="btn btn-block">설정으로 돌아가기</Link>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              declineResearch();
              nav(next);
            }}
          >
            참여하지 않고 쓰기
          </button>
        )}
      </div>
    </main>
  );
}
