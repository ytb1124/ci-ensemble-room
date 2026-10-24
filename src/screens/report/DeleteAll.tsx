import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { deleteAllData } from '../../store/exportData';

/** 전체 삭제: 화면 안 확인 카드 2단계 */
export function DeleteAll() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" style={{ fontWeight: 600 }}>
        이 기기에 있던 설정, 기록, 답을 모두 지웠어요.
      </p>
    );
  }
  if (step === 0) {
    return (
      <button type="button" className="btn" onClick={() => setStep(1)}>
        <Icon name="trash" /> 이 기기의 모든 데이터 지우기
      </button>
    );
  }
  return (
    <div className="card card-soft stack" role="alertdialog" aria-labelledby="set-del-title" style={{ borderColor: 'var(--error)' }}>
      <h3 id="set-del-title">{step === 1 ? '모두 지울까요?' : '마지막으로 확인해요'}</h3>
      <p>
        {step === 1
          ? '소리 맞추기 설정, 합주실 기록, 잠깐 질문의 답, 나의 청취 단서가 이 기기에서 지워져요.'
          : '지우면 되돌릴 수 없어요. 필요하면 먼저 [내보내기]로 파일을 받아 두세요.'}
      </p>
      <div className="row">
        <button type="button" className="btn btn-primary" autoFocus onClick={() => setStep(0)}>
          아니요, 그대로 둘게요
        </button>
        {step === 1 ? (
          <button type="button" className="btn" onClick={() => setStep(2)}>
            다음
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
            onClick={() => {
              deleteAllData();
              setDone(true);
            }}
          >
            <Icon name="trash" /> 모두 지우기
          </button>
        )}
      </div>
    </div>
  );
}
