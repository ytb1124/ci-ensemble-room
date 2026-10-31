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
import { getLang, ko, tx } from '../i18n';
import { DeleteAll } from './report/DeleteAll';
import { ResearchSection } from './ResearchSection';
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
        {checked ? tx('켬', 'On') : tx('끔', 'Off')}
      </button>
    </div>
  );
}

const steps = () => [
  tx('듣기 환경', 'Your setup'),
  tx('편안한 크기', 'Comfortable volume'),
  tx('좌우', 'Left/right'),
  tx('소리 색', 'Tone'),
  tx('악기 섞기', 'Instrument mix'),
  tx('저음 도움', 'Bass help'),
];

export default function Settings() {
  const p = useProfile();
  const st = useEngineState();
  const [syncOpen, setSyncOpen] = useState(false);
  const lat = engine.latencyInfo();

  const setViz = (patch: Partial<Profile['viz']>) => updateProfile((cur) => ({ viz: { ...cur.viz, ...patch } }));
  const ms = (v: number | null) => (v === null ? tx('알 수 없어요', 'Unknown') : `${Math.round(v * 1000)} ms`);

  const syncMethod =
    p.sync.method === 'tap'
      ? tx('탭으로 맞춤', 'Set by tapping')
      : p.sync.method === 'preset-bt'
        ? tx('블루투스 기본값', 'Bluetooth default')
        : p.sync.userOffsetMs !== 0
          ? tx('직접 맞춤', 'Set by hand')
          : tx('자동', 'Automatic');

  return (
    <main className="page page-narrow stack-lg">
      <h1>{tx('설정', 'Settings')}</h1>

      <section className="card stack" aria-labelledby="set-calib">
        <h2 id="set-calib">{tx('소리 맞추기', 'Sound setup')}</h2>
        <ul className="set-steps">
          {steps().map((name, i) => (
            <li key={name}>
              <span>
                <strong>{'①②③④⑤⑥'[i]}</strong> {name}
                <span className="small muted"> · {p.calibStepsDone.includes(i + 1) ? tx('완료', 'Done') : tx('아직 안 함', 'Not done yet')}</span>
              </span>
              <Link to={`/calibrate/${i + 1}?only=1&next=/settings`} className="btn btn-sm" aria-label={getLang() === 'en' ? `Set ${name} again` : `${name} 다시 맞추기`}>
                {tx('바꾸기', 'Change')}
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <Link to="/calibrate" className="btn">
            <Icon name="refresh" size={20} /> {tx('처음부터 다시', 'Start over')}
          </Link>
        </div>
        <details>
          <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{tx('지금 값 보기', 'Show current values')}</summary>
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
        <h2 id="set-view">{tx('보기', 'View')}</h2>
        <div className="set-row">
          <span className="set-label">{tx('기본 보기', 'Default view')}</span>
          <Segmented<ViewMode>
            label={tx('기본 보기', 'Default view')}
            hideLabel
            value={p.viz.defaultView}
            options={[
              { value: 'off', label: tx('끔', 'Off') },
              { value: 'lanes', label: tx('악기별', 'By instrument') },
              { value: 'explore', label: tx('자세히', 'Detailed') },
            ]}
            onChange={(v) => {
              setViz({ defaultView: v });
              logEvent({ type: 'view', value: v });
            }}
          />
        </div>
        <Switch label={tx('음높이 선', 'Pitch lines')} checked={p.viz.pitchLines} onChange={(v) => setViz({ pitchLines: v })} />
        <div className="set-row">
          <span className="set-label">{tx('움직임 강도', 'Motion')}</span>
          <Segmented<MotionLevel>
            label={tx('움직임 강도', 'Motion')}
            hideLabel
            value={p.viz.motion}
            options={[
              { value: 'off', label: tx('없음', 'None') },
              { value: 'calm', label: tx('적게', 'Low') },
              { value: 'normal', label: tx('보통', 'Medium') },
              { value: 'vivid', label: tx('많이', 'High') },
            ]}
            onChange={(v) => {
              setViz({ motion: v });
              logEvent({ type: 'motion', value: v });
            }}
          />
        </div>
        <Switch
          label={tx('곡을 처음 열면 소리만 먼저 듣기', 'Listen first when a song opens')}
          checked={p.viz.listenFirst}
          onChange={(v) => setViz({ listenFirst: v })}
          hint={tx('켜 두면 처음에는 그림 없이 듣고, 원할 때 그림을 켤 수 있어요.', 'When on, you first listen without pictures. You can turn the pictures on when you want.')}
        />
        <div className="set-row">
          <span className="set-label">{tx('화면 색', 'Screen color')}</span>
          <Segmented<Theme>
            label={tx('화면 색', 'Screen color')}
            hideLabel
            value={p.viz.theme}
            options={[
              { value: 'system', label: tx('기기 설정대로', 'Match device') },
              { value: 'light', label: tx('밝게', 'Light') },
              { value: 'dark', label: tx('어둡게', 'Dark') },
            ]}
            onChange={(v) => setViz({ theme: v })}
          />
        </div>
      </section>

      <section className="card stack" aria-labelledby="set-sync">
        <h2 id="set-sync">{tx('화면-소리 맞추기', 'Sync picture and sound')}</h2>
        <p className="small muted">
          {tx('그림이 소리보다 늦거나 빠르면 맞춰 보세요. 지금 방식:', 'If the pictures are behind or ahead of the sound, adjust them. Current method:')} <strong>{syncMethod}</strong>
        </p>
        <DbSlider
          label={tx('직접 맞추기', 'Adjust by hand')}
          value={p.sync.userOffsetMs}
          min={-300}
          max={300}
          step={10}
          unit="ms"
          formatValue={(v) => `${v > 0 ? '+' : ''}${v} ms`}
          onChange={(v) => updateProfile((cur) => ({ sync: { ...cur.sync, userOffsetMs: v } }))}
        />
        <p className="small muted">{tx('+는 그림을 늦추고, −는 그림을 앞당겨요.', '+ delays the pictures, − moves them earlier.')}</p>
        <div className="row">
          {syncOpen ? null : st.unlocked ? (
            <button type="button" className="btn" onClick={() => setSyncOpen(true)}>
              <Icon name="play" size={20} /> {tx('탭으로 맞추기', 'Sync by tapping')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => updateProfile((cur) => ({ sync: { ...cur.sync, userOffsetMs: 0, method: 'auto', calibratedAt: null } }))}
          >
            {tx('자동으로 되돌리기', 'Reset to automatic')}
          </button>
        </div>
        {!st.unlocked && !syncOpen && <SoundOnButton label={tx('소리 켜고 탭으로 맞추기', 'Turn on sound and sync by tapping')} />}
        {syncOpen && st.unlocked && <SyncCard onClose={() => setSyncOpen(false)} />}
        <dl className="set-kv">
          <dt>{tx('이 기기의 소리 지연 (참고)', 'Sound delay on this device (for reference)')}</dt>
          <dd>
            {st.unlocked
              ? tx(ko`기본 ${ms(lat.baseLatency)} · 출력 ${ms(lat.outputLatency)}`, `Base ${ms(lat.baseLatency)} · Output ${ms(lat.outputLatency)}`)
              : tx('소리를 켜면 보여요', 'Shown when sound is on')}
          </dd>
        </dl>
      </section>

      <section className="card stack" aria-labelledby="set-sound">
        <h2 id="set-sound">{tx('소리', 'Sound')}</h2>
        <Switch
          label={tx('혼자 들어도 같은 크기로', 'Same volume when solo')}
          checked={p.soloLoudnessMatch}
          onChange={(v) => updateProfile({ soloLoudnessMatch: v })}
          hint={tx('한 악기만 골라 들을 때도 함께 들을 때와 비슷한 크기로 들려요.', 'When you solo one instrument, it sounds about as loud as when all play together.')}
        />
        <Switch
          label={tx('더 크게 키울 수 있게 (+12 dB)', 'Allow louder (+12 dB)')}
          checked={p.allowPlus12}
          onChange={(v) =>
            updateProfile((cur) => {
              if (v) return { allowPlus12: true };
              // 끌 때는 +6 dB를 넘는 값을 +6 dB로 맞춘다
              const clamp = (g: Profile['instGainDb']) =>
                Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.min(6, v)])) as Profile['instGainDb'];
              const so: Profile['songOverrides'] = {};
              (Object.keys(cur.songOverrides) as (keyof Profile['songOverrides'])[]).forEach((k) => {
                const o = cur.songOverrides[k];
                if (o) so[k] = { instGainDb: clamp(o.instGainDb) };
              });
              return { allowPlus12: false, instGainDb: clamp(cur.instGainDb), songOverrides: so };
            })
          }
          hint={tx('악기 섞기에서 한 악기를 더 크게 키울 수 있어요. 소리가 갑자기 커질 수 있으니 조심해 주세요.', 'Lets you turn one instrument up more in Instrument mix. The sound may suddenly get loud, so please be careful.')}
        />
        <div className="set-row">
          <span className="set-label">
            {tx('임시 소리 모양', 'Placeholder sound type')}
            <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
              {tx('실제 악기 녹음이 들어오면 이 설정은 사라져요.', 'This setting will go away once the real instrument recordings are in.')}
            </span>
          </span>
          <Segmented<PlaceholderShape>
            label={tx('임시 소리 모양', 'Placeholder sound type')}
            hideLabel
            value={p.placeholderShape}
            options={[
              { value: 'rhythm', label: tx('박자에 맞춰 끊기는 잡음 (기본)', 'Noise that stops and starts with the beat (default)') },
              { value: 'steady', label: tx('계속 나는 잡음', 'Steady noise') },
            ]}
            onChange={(v) => {
              updateProfile({ placeholderShape: v });
              void engine.reloadSong();
            }}
          />
        </div>
      </section>

      <ResearchSection />

      <section className="card stack" aria-labelledby="set-data">
        <h2 id="set-data">{tx('데이터', 'Data')}</h2>
        {!storageAvailable() && (
          <p role="status" style={{ fontWeight: 600 }}>
            {tx(
              '이 기기에서는 기록이 남지 않아요. 창을 닫으면 설정과 응답이 사라져요. 필요하면 아래 [내보내기]로 파일을 받아 두세요.',
              'Records are not saved on this device. When you close the window, your settings and answers will be lost. If needed, save a file with [Export] below.',
            )}
          </p>
        )}
        <p className="small muted">
          {tx(
            '이름이나 연락처는 받지 않아요. 연구에 참여하지 않았다면 모든 기록은 이 기기 안에만 있어요. 아래 [지우기]는 이 기기의 기록만 지워요. 연구팀에 보낸 기록은 위 [연구 참여]에서 지울 수 있어요.',
            'We do not ask for your name or contact details. If you have not joined the study, all records stay only on this device. [Delete] below deletes only the records on this device. Records sent to the research team can be deleted in [Study participation] above.',
          )}
        </p>
        <ExportButtons />
        <DeleteAll />
      </section>

      <p>
        <Link to="/about" className="btn">
          <Icon name="info" size={20} /> {tx('이 앱은 무엇인가요?', 'What is this app?')}
        </Link>
      </p>
    </main>
  );
}
