// 연구 참여: 동의 + 배경 설문. 참여 중이면 배경 설문만 고친다.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/controls';
import {
  declineResearch, joinResearch, researchEnabled, retentionText, updateSurvey, useResearch, type Survey,
} from '../store/research';
import { getLang, tx } from '../i18n';

type Q = { key: keyof Survey; title: string; options: [string, string][] };

// 값(영문 코드)은 서버에 그대로 남는다. 글자를 바꿔도 코드는 바꾸지 않는다
const questions = (): Q[] => [
  { key: 'ageGroup', title: tx('나이대', 'Age group'), options: [['u19', tx('10대 이하', '19 or under')], ['20s', tx('20대', '20s')], ['30s', tx('30대', '30s')], ['40s', tx('40대', '40s')], ['50s', tx('50대', '50s')], ['60p', tx('60대 이상', '60 or over')]] },
  {
    key: 'wearing',
    title: tx('어떻게 듣고 있나요?', 'How do you hear?'),
    options: [
      ['bilateral', tx('양쪽 인공와우', 'CIs in both ears')],
      ['unilateral', tx('한쪽 인공와우', 'CI in one ear')],
      ['bimodal', tx('인공와우 + 반대쪽 보청기', 'CI + hearing aid in the other ear')],
      ['ssd', tx('인공와우 + 반대쪽은 잘 들림', 'CI + typical hearing in the other ear')],
      ['unknown', tx('잘 모르겠어요', 'Not sure')],
    ],
  },
  { key: 'ciYears', title: tx('인공와우를 쓴 지', 'How long you have used a CI'), options: [['lt1', tx('1년 안 됨', 'Less than 1 year')], ['1to3', tx('1–3년', '1–3 years')], ['3to10', tx('3–10년', '3–10 years')], ['gt10', tx('10년 넘게', 'More than 10 years')]] },
  {
    key: 'onset',
    title: tx('청력이 약해진 때', 'When your hearing loss began'),
    options: [
      ['prelingual', tx('태어날 때부터 또는 말을 배우기 전', 'From birth or before learning to speak')],
      ['child', tx('말을 배운 뒤, 어릴 때', 'As a child, after learning to speak')],
      ['adult', tx('어른이 된 뒤', 'As an adult')],
      ['unknown', tx('잘 모르겠어요', 'Not sure')],
    ],
  },
  { key: 'maker', title: tx('인공와우 회사', 'CI manufacturer'), options: [['cochlear', tx('코클리어', 'Cochlear')], ['medel', tx('메드엘', 'MED-EL')], ['ab', tx('어드밴스드 바이오닉스', 'Advanced Bionics')], ['oticon', tx('오티콘', 'Oticon')], ['unknown', tx('잘 모르겠어요', 'Not sure')]] },
  { key: 'music', title: tx('음악 경험', 'Music experience'), options: [['none', tx('배운 적 없어요', 'Never learned music')], ['some', tx('조금 배웠어요', 'Learned a little')], ['regular', tx('꾸준히 하거나 했어요', 'Play or played regularly')]] },
  { key: 'route', title: tx('이 앱을 주로 듣는 방법', 'How you mostly listen to this app'), options: [['direct', tx('프로세서에 직접 연결', 'Streamed to your processor')], ['speaker', tx('스피커', 'Speakers')], ['headphones', tx('이어폰·헤드폰', 'Earphones or headphones')]] },
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
        <h1>{tx('연구 참여', 'Join the study')}</h1>
        <p>{tx('아직 연구 서버가 연결되지 않았어요. 앱은 그대로 쓸 수 있어요.', 'The study server is not connected yet. You can still use the app as usual.')}</p>
        <Link to={next} className="btn">{tx('돌아가기', 'Go back')}</Link>
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
        <h1 style={{ margin: 0 }}>{joined ? tx('배경 질문 고치기', 'Edit background questions') : tx('연구에 함께해 주실래요?', 'Would you like to join our study?')}</h1>
        {!joined && (
          <p className="lead" style={{ margin: 0 }}>
            {tx(
              '인공와우로 음악을 듣는 사람마다 무엇이 잘 들리는지 알아보려고 해요. 참여하지 않아도 앱은 똑같이 쓸 수 있어요.',
              'We want to learn what each person hears well when listening to music with a cochlear implant. You can use the app the same way even if you do not join.',
            )}
          </p>
        )}
      </header>

      {!joined && (
        <section className="card stack" aria-labelledby="join-what">
          <h2 id="join-what" style={{ margin: 0 }}>{tx('무엇을 모으나요?', 'What do we collect?')}</h2>
          <ul className="stack" style={{ margin: 0, paddingLeft: 20, gap: 6 }}>
            <li>{tx('소리 맞추기에서 고른 값(크기, 소리 색, 저음 도움 등)', 'The values you picked in Sound setup (volume, tone, bass help, and so on)')}</li>
            <li>{tx('합주실에서 누른 기록(골라 듣기, 빼고 듣기, 크기 바꾸기)', 'What you pressed in the Ensemble Room (Solo, Mute, volume changes)')}</li>
            <li>{tx('잠깐 질문의 답', 'Your answers to Quick questions')}</li>
            <li>{tx('아래 배경 질문의 답(인공와우 사용 정보 포함)', 'Your answers to the background questions below (including information about your CI use)')}</li>
          </ul>
          <p style={{ margin: 0 }}>{tx('참여하기 전에 이 기기에 쌓인 기록도 함께 보내요.', 'Records saved on this device before you join are sent too.')}</p>
          <h2 style={{ margin: 0 }}>{tx('모으지 않는 것', 'What we do not collect')}</h2>
          <p style={{ margin: 0 }}>{tx('이름, 연락처, 이메일, 목소리 녹음은 받지 않아요. 무작위 번호로만 구분해요.', 'We do not collect your name, contact details, email, or voice recordings. You are identified only by a random number.')}</p>
          <h2 style={{ margin: 0 }}>{tx('보관과 그만두기', 'Storage and leaving')}</h2>
          <p style={{ margin: 0 }}>
            {getLang() === 'en' ? (
              <>
                Records are stored on the research team’s server and used only for research. {retentionText()} You can leave at any time in [Settings → Study
                participation]. If you leave, all records you sent are deleted.
              </>
            ) : (
              <>
                연구팀 서버에 보관하고, 연구에만 써요. {retentionText()} [설정 → 연구 참여]에서 언제든 그만둘 수 있고, 그만두면 보낸 기록이 모두 지워져요.
              </>
            )}
          </p>
        </section>
      )}

      <section className="card stack-lg" aria-labelledby="join-survey">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="join-survey" style={{ margin: 0 }}>{tx('배경 질문 (1분)', 'Background questions (1 min)')}</h2>
          <p className="small muted" style={{ margin: 0 }}>{tx('답하고 싶지 않은 질문은 건너뛰어도 돼요. 고른 답을 한 번 더 누르면 선택이 풀려요.', 'You can skip any question you do not want to answer. Press a chosen answer again to unselect it.')}</p>
        </div>
        {questions().map((q) => (
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
        <section className="card card-soft stack" aria-label={tx('동의', 'Consent')}>
          <label className="join-check">
            <input type="checkbox" checked={agreeData} onChange={(e) => setAgreeData(e.target.checked)} />
            <span>{tx('[필수] 위 기록을 연구에 쓰는 데 동의해요.', '[Required] I agree to the use of the records above for research.')}</span>
          </label>
          <label className="join-check">
            <input type="checkbox" checked={agreeHealth} onChange={(e) => setAgreeHealth(e.target.checked)} />
            <span>
              {tx(
                '[필수] 인공와우 사용 정보는 건강 정보예요. 이 정보를 모으고 쓰는 데 따로 동의해요.',
                '[Required] Information about my cochlear implant use is health information. I separately agree to the collection and use of this information.',
              )}
            </span>
          </label>
        </section>
      )}

      {rs.error && (
        <p role="alert" style={{ color: 'var(--error)', fontWeight: 600, margin: 0 }}>
          {tx('보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', 'Could not send. Please check your internet connection and press again.')} ({rs.error})
        </p>
      )}
      {saved && <p role="status" style={{ fontWeight: 600, margin: 0 }}>{tx('저장했어요.', 'Saved.')}</p>}

      <div className="stack">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={busy || (!joined && !(agreeData && agreeHealth))}
          onClick={() => void submit()}
        >
          {busy ? tx('보내는 중…', 'Sending…') : joined ? tx('저장하기', 'Save') : tx('동의하고 참여하기', 'Agree and join')}
          {!busy && !joined && <Icon name="chevronRight" />}
        </button>
        {joined ? (
          <Link to="/settings" className="btn btn-block">{tx('설정으로 돌아가기', 'Back to Settings')}</Link>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              declineResearch();
              nav(next);
            }}
          >
            {tx('참여하지 않고 쓰기', 'Use without joining')}
          </button>
        )}
      </div>
    </main>
  );
}
