// 설정 > 연구 참여: 상태, 지금 보내기, 배경 질문 고치기, 그만두기(보낸 기록 지우기)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { researchEnabled, syncNow, useResearch, withdrawResearch } from '../store/research';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '아직 없어요');

export function ResearchSection() {
  const rs = useResearch();
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  if (!researchEnabled) return null;

  return (
    <section className="card stack" aria-labelledby="set-research">
      <h2 id="set-research">연구 참여</h2>
      {rs.status !== 'joined' ? (
        <>
          <p style={{ margin: 0 }}>
            {rs.status === 'withdrawn' ? '참여를 그만뒀고, 보낸 기록을 모두 지웠어요.' : '지금은 참여하지 않고 있어요. 기록은 이 기기 안에만 있어요.'}
          </p>
          <div className="row">
            <Link to="/join?next=/settings" className="btn btn-sm">자세히 보고 참여하기</Link>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }} role="status">
            참여 중이에요. 마지막으로 보낸 때: {rs.syncing ? '보내는 중…' : time(rs.lastSyncAt)}
          </p>
          {rs.error && <p className="small" style={{ color: 'var(--error)', margin: 0 }}>보내지 못한 기록이 있어요. 인터넷이 연결되면 다시 보내요.</p>}
          <div className="row">
            <button type="button" className="btn btn-sm" disabled={rs.syncing} onClick={() => void syncNow()}>
              <Icon name="refresh" size={18} /> 지금 보내기
            </button>
            <Link to="/join?next=/settings" className="btn btn-sm">배경 질문 고치기</Link>
          </div>
          {step === 0 ? (
            <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setStep(1)}>
              참여 그만두기
            </button>
          ) : (
            <div className="card card-soft stack" role="alertdialog" aria-labelledby="set-wd-title" style={{ borderColor: 'var(--error)' }}>
              <h3 id="set-wd-title">참여를 그만둘까요?</h3>
              <p style={{ margin: 0 }}>연구팀 서버에 보낸 기록이 모두 지워지고 되돌릴 수 없어요. 이 기기의 설정과 기록은 그대로 남아요.</p>
              <div className="row">
                <button type="button" className="btn btn-primary" autoFocus onClick={() => setStep(0)}>
                  아니요, 계속할게요
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
                  <Icon name="trash" /> {busy ? '지우는 중…' : '그만두고 지우기'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
