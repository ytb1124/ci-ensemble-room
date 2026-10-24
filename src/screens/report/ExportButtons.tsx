import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { downloadCSV, downloadJSON } from '../../store/exportData';

/** 내보내기 버튼 한 쌍. 이름·연락처는 받지 않는다는 안내 포함 */
export function ExportButtons() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            downloadJSON();
            setDone('JSON 파일을 내려받았어요.');
          }}
        >
          <Icon name="download" /> JSON으로 내보내기
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            downloadCSV();
            setDone('CSV 파일을 내려받았어요.');
          }}
        >
          <Icon name="download" /> CSV로 내보내기
        </button>
      </div>
      <p className="small muted">
        이름이나 연락처는 들어 있지 않아요. 파일은 버튼을 누를 때만 이 기기에 저장되고, 어디로도 자동으로 보내지 않아요.
      </p>
      <p className="small" role="status" aria-live="polite" style={{ minHeight: 20, margin: 0 }}>
        {done}
      </p>
    </div>
  );
}
