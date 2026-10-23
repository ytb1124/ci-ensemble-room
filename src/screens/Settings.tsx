// S4. 설정 (구성안 3.3절 S4, 7.3절 설정 표)
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SoundOnButton } from '../components/SoundGate';
import { Icon } from '../components/ui/Icon';
import { DbSlider, Segmented } from '../components/ui/controls';
import { SyncCard } from '../components/viz/SyncCard';
import { engine, useEngineState } from '../audio/useEngine';
import { logEvent } from '../store/log';
import { updateProfile, useProfile } from '../store/profile';
import { profileLines } from '../store/reportRules';
import { storageAvailable } from '../store/storage';
import type { MotionLevel, PlaceholderShape, Profile, Theme, ViewMode } from '../types';
import { DeleteAll } from './report/DeleteAll';
import { ExportButtons } from './report/ExportButtons';
import './settings.css';

function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-label">
        {label}
        {hint && <div className="small muted" style={{ fontWeight: 400 }}>{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="set-switch" onClick={() => onChange(!checked)}>
        <Icon name={checked ? 'on' : 'off'} size={20} />
        {checked ? '켬' : '끔'}
      </button>
    </div>
  );
}

const STEPS = ['듣기 환경', '편안한 크기', '좌우', '소리 색', '악기 섞기', '저음 도움'];

export default function Settings() {
  const p = useProfile();
  const st = useEngineState();
  const [syncOpen, setSyncOpen] = useState(false);
  const lat = engine.latencyInfo();

  const setViz = (patch: Partial<Profile['viz']>) => updateProfile((cur) => ({ viz: { ...cur.viz, ...patch } }));
  const ms = (v: number | null) => (v === null ? '알 수 없어요' : `${Math.round(v * 1000)} ms`);

  const syncMethod =
    p.sync.method === 'tap' ? '탭 보정' : p.sync.method === 'preset-bt' ? '블루투스 프리셋' : p.sync.userOffsetMs !== 0 ? '수동' : '자동';

  return (
    <main className="page page-narrow stack-lg">
      <h1>설정</h1>

      <section className="card stack" aria-labelledby="set-calib">
        <h2 id="set-calib">소리 맞춤</h2>
        <ul className="set-steps">
          {STEPS.map((name, i) => (
            <li key={name}>
              <span>
                <strong>{'①②③④⑤⑥'[i]}</strong> {name}
                <span className="small muted"> · {p.calibStepsDone.includes(i + 1) ? '해 봤어요' : '아직'}</span>
              </span>
              <Link to={`/calibrate/${i + 1}?only=1&next=/settings`} className="btn btn-sm" aria-label={`${name} 다시 맞추기`}>
                바꾸기
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <Link to="/calibrate" className="btn">
            <Icon name="refresh" size={20} /> 처음부터 다시
          </Link>
        </div>
        <details>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>지금 값 보기</summary>
          <dl className="set-kv" style={{ marginTop: 8 }}>
            {profileLines(p).map((l) => (
              <div key={l.label} style={{ display: 'contents' }}>
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section className="card stack" aria-labelledby="set-view">
        <h2 id="set-view">보기</h2>
        <div className="set-row">
          <span className="set-label">기본 보기</span>
          <Segmented<ViewMode>
            label="기본 보기"
            hideLabel
            value={p.viz.defaultView}
            options={[
              { value: 'off', label: '끔' },
              { value: 'lanes', label: '레인' },
              { value: 'explore', label: '탐색' },
            ]}
            onChange={(v) => {
              setViz({ defaultView: v });
              logEvent({ type: 'view', value: v });
            }}
          />
        </div>
        <Switch label="피치 라인" checked={p.viz.pitchLines} onChange={(v) => setViz({ pitchLines: v })} />
        <div className="set-row">
          <span className="set-label">움직임 강도</span>
          <Segmented<MotionLevel>
            label="움직임 강도"
            hideLabel
            value={p.viz.motion}
            options={[
              { value: 'off', label: '끄기' },
              { value: 'calm', label: '차분' },
              { value: 'normal', label: '보통' },
              { value: 'vivid', label: '화려' },
            ]}
            onChange={(v) => {
              setViz({ motion: v });
              logEvent({ type: 'motion', value: v });
            }}
          />
        </div>
        <Switch
          label="곡 처음 열 때 소리만 듣기"
          checked={p.viz.listenFirst}
          onChange={(v) => setViz({ listenFirst: v })}
          hint="켜 두면 처음에는 그림 없이 듣고, 원할 때 보기를 켜요."
        />
        <div className="set-row">
          <span className="set-label">배경</span>
          <Segmented<Theme>
            label="배경"
            hideLabel
            value={p.viz.theme}
            options={[
              { value: 'system', label: '기기 설정 따름' },
              { value: 'light', label: '밝게' },
              { value: 'dark', label: '어둡게' },
            ]}
            onChange={(v) => setViz({ theme: v })}
          />
        </div>
      </section>

      <section className="card stack" aria-labelledby="set-sync">
        <h2 id="set-sync">화면-소리 맞추기</h2>
        <p className="small muted">
          소리와 그림이 어긋나 보이면 맞춰 보세요. 지금 방식: <strong>{syncMethod}</strong>
        </p>
        <DbSlider
          label="수동으로 맞추기"
          value={p.sync.userOffsetMs}
          min={-300}
          max={300}
          step={10}
          unit="ms"
          formatValue={(v) => `${v > 0 ? '+' : ''}${v} ms`}
          onChange={(v) => updateProfile((cur) => ({ sync: { ...cur.sync, userOffsetMs: v } }))}
        />
        <p className="small muted">+는 그림을 늦추고, −는 그림을 앞당겨요.</p>
        <div className="row">
          {syncOpen ? null : st.unlocked ? (
            <button type="button" className="btn" onClick={() => setSyncOpen(true)}>
              <Icon name="play" size={20} /> 탭으로 맞추기
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => updateProfile((cur) => ({ sync: { ...cur.sync, userOffsetMs: 0, method: 'auto', calibratedAt: null } }))}
          >
            자동으로 되돌리기
          </button>
        </div>
        {!st.unlocked && !syncOpen && <SoundOnButton label="소리 켜고 탭으로 맞추기" />}
        {syncOpen && st.unlocked && <SyncCard onClose={() => setSyncOpen(false)} />}
        <dl className="set-kv">
          <dt>이 기기 지연(참고)</dt>
          <dd>
            {st.unlocked
              ? `기본 ${ms(lat.baseLatency)} · 출력 ${ms(lat.outputLatency)}`
              : '소리를 켜면 보여요'}
          </dd>
        </dl>
      </section>

      <section className="card stack" aria-labelledby="set-sound">
        <h2 id="set-sound">소리</h2>
        <Switch
          label="솔로 크기 맞춤"
          checked={p.soloLoudnessMatch}
          onChange={(v) => updateProfile({ soloLoudnessMatch: v })}
          hint="한 악기만 들을 때도 비슷한 크기로 들려요."
        />
        <Switch
          label="+12 dB까지 허용"
          checked={p.allowPlus12}
          onChange={(v) =>
            updateProfile((cur) => {
              if (v) return { allowPlus12: true };
              // 끌 때는 +6 dB를 넘는 값을 +6 dB로 맞춘다
              const clamp = (g: Profile['instGainDb']) => ({
                cajon: Math.min(6, g.cajon),
                bass: Math.min(6, g.bass),
                trumpet: Math.min(6, g.trumpet),
              });
              const so: Profile['songOverrides'] = {};
              (Object.keys(cur.songOverrides) as (keyof Profile['songOverrides'])[]).forEach((k) => {
                const o = cur.songOverrides[k];
                if (o) so[k] = { instGainDb: clamp(o.instGainDb) };
              });
              return { allowPlus12: false, instGainDb: clamp(cur.instGainDb), songOverrides: so };
            })
          }
          hint="악기 섞기에서 더 크게 키울 수 있어요. 소리가 커지니 조심해서 써 주세요."
        />
        <div className="set-row">
          <span className="set-label">
            자리표시 소리 모양
            <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
              실제 악기 녹음이 들어오면 이 설정은 사라져요.
            </span>
          </span>
          <Segmented<PlaceholderShape>
            label="자리표시 소리 모양"
            hideLabel
            value={p.placeholderShape}
            options={[
              { value: 'rhythm', label: '박자에 맞춰 끊기는 잡음(기본)' },
              { value: 'steady', label: '계속 나는 잡음' },
            ]}
            onChange={(v) => {
              updateProfile({ placeholderShape: v });
              void engine.reloadSong();
            }}
          />
        </div>
      </section>

      <section className="card stack" aria-labelledby="set-data">
        <h2 id="set-data">데이터</h2>
        {!storageAvailable() && (
          <p role="status" style={{ fontWeight: 600 }}>
            이 기기에서는 기록이 남지 않아요. 창을 닫으면 설정과 응답이 사라져요. 필요하면 내보내기로 파일을 받아 두세요.
          </p>
        )}
        <p className="small muted">모든 기록은 이 기기 안에만 있어요. 이름이나 연락처는 받지 않아요.</p>
        <ExportButtons />
        <DeleteAll />
      </section>

      <p>
        <Link to="/about" className="btn">
          <Icon name="info" size={20} /> 이 프로그램은 무엇인가요?
        </Link>
      </p>
    </main>
  );
}
