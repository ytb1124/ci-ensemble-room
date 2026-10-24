// 설정 > 연구 참여: 상태, 지금 보내기, 배경 질문 고치기, 그만두기(보낸 기록 지우기)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { researchEnabled, syncNow, useResearch, withdrawResearch } from '../store/research';
import { locale, tx } from '../i18n';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : tx('아직 없어요', 'Not yet'));

export function ResearchSection() {
  const rs = useResearch();
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  if (!researchEnabled) return null;

  return (
    <section className="card stack" aria-labelledby="set-research">
      <h2 id="set-research">{tx('연구 참여', 'Study participation')}</h2>
      {rs.status !== 'joined' ? (
        <>
          <p style={{ margin: 0 }}>
            {rs.status === 'withdrawn'
              ? tx('참여를 그만뒀고, 보낸 기록을 모두 지웠어요.', 'You left the study, and all records you sent were deleted.')
              : tx('지금은 참여하지 않고 있어요. 기록은 이 기기 안에만 있어요.', 'You are not in the study right now. Your records stay only on this device.')}
          </p>
          <div className="row">
            <Link to="/join?next=/settings" className="btn btn-sm">{tx('자세히 보고 참여하기', 'Learn more and join')}</Link>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }} role="status">
            {tx('참여 중이에요. 마지막으로 보낸 때:', 'You are in the study. Last sent:')} {rs.syncing ? tx('보내는 중…', 'Sending…') : time(rs.lastSyncAt)}
          </p>
          {rs.error && <p className="small" style={{ color: 'var(--error)', margin: 0 }}>{tx('보내지 못한 기록이 있어요. 인터넷이 연결되면 다시 보내요.', 'Some records could not be sent. They will be sent again when you are online.')}</p>}
          <div className="row">
            <button type="button" className="btn btn-sm" disabled={rs.syncing} onClick={() => void syncNow()}>
              <Icon name="refresh" size={18} /> {tx('지금 보내기', 'Send now')}
            </button>
            <Link to="/join?next=/settings" className="btn btn-sm">{tx('배경 질문 고치기', 'Edit background questions')}</Link>
          </div>
          {step === 0 ? (
            <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setStep(1)}>
              {tx('참여 그만두기', 'Leave the study')}
            </button>
          ) : (
            <div className="card card-soft stack" role="alertdialog" aria-labelledby="set-wd-title" style={{ borderColor: 'var(--error)' }}>
              <h3 id="set-wd-title">{tx('참여를 그만둘까요?', 'Leave the study?')}</h3>
              <p style={{ margin: 0 }}>
                {tx(
                  '연구팀 서버에 보낸 기록이 모두 지워지고 되돌릴 수 없어요. 이 기기의 설정과 기록은 그대로 남아요.',
                  'All records sent to the research team’s server will be deleted. This cannot be undone. Settings and records on this device will stay.',
                )}
              </p>
              <div className="row">
                <button type="button" className="btn btn-primary" autoFocus onClick={() => setStep(0)}>
                  {tx('아니요, 계속할게요', 'No, stay in')}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await withdrawResearch();
                    setBusy(false);
                    if (ok) setStep(0);
                  }}
                >
                  <Icon name="trash" /> {busy ? tx('지우는 중…', 'Deleting…') : tx('그만두고 지우기', 'Leave and delete')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
