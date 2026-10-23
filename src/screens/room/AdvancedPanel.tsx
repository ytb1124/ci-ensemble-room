import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { DbSlider, Chip } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { effectiveInstGain, gainRange, updateProfile, useProfile } from '../../store/profile';
import { logEvent } from '../../store/log';
import { INSTRUMENTS, INSTRUMENT_LABEL, type BassAssist, type InstrumentId, type SongId } from '../../types';

const PRESETS: { label: string; id: InstrumentId }[] = [
  { label: '멜로디 또렷하게', id: 'trumpet' },
  { label: '박 또렷하게', id: 'cajon' },
  { label: '저음 또렷하게', id: 'bass' },
];

export function AdvancedPanel({
  song, blind, onBlind, onReveal, revealed,
}: {
  song: SongId; blind: boolean; onBlind: (v: boolean) => void; onReveal: () => void; revealed: boolean;
}) {
  const profile = useProfile();
  const st = useEngineState();
  const [open, setOpen] = useState(false);
  const base = effectiveInstGain(profile, song);
  const [draft, setDraft] = useState<Record<InstrumentId, number> | null>(null);
  const cur = draft ?? base;
  const range = gainRange(profile);

  const apply = (next: Record<InstrumentId, number>) => {
    setDraft(next);
    engine.setPreview({ instGainDb: next });
  };
  const change = (id: InstrumentId, v: number) => {
    const from = cur[id];
    if (from === v) return;
    apply({ ...cur, [id]: v });
  };
  const logDiff = (id: InstrumentId, to: number) => {
    const from = base[id];
    if (from !== to) logEvent({ type: 'gain', instrument: id, fromDb: from, toDb: to, song });
  };
  const save = () => {
    if (!draft) return;
    updateProfile((p) => ({ songOverrides: { ...p.songOverrides, [song]: { instGainDb: draft } } }));
    engine.setPreview(null);
    setDraft(null);
  };
  const revert = () => {
    updateProfile((p) => {
      const so = { ...p.songOverrides };
      delete so[song];
      return { songOverrides: so };
    });
    engine.setPreview(null);
    setDraft(null);
  };
  const preset = (id: InstrumentId) => {
    const next = { ...base, [id]: Math.min(range.max, 6) };
    apply(next);
    logDiff(id, next[id]);
  };
  const assists: { v: BassAssist; label: string }[] = [
    { v: 'none', label: '없음' },
    { v: 'boost', label: '저음 키우기' },
    { v: 'octaveUp', label: '한 옥타브 위' },
  ];

  return (
    <section className="card stack" aria-label="자세히">
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="room-adv"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>자세히 · 악기별 크기 · 저음 도움 · 원래 소리</span>
        <Icon name="chevronDown" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div id="room-adv" className="stack-lg">
          <div className="stack">
            <h3 style={{ margin: 0 }}>악기별 크기</h3>
            <div className="room-adv-grid">
              {INSTRUMENTS.map((id) => (
                <DbSlider
                  key={id}
                  label={INSTRUMENT_LABEL[id]}
                  value={cur[id]}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  onChange={(v) => change(id, v)}
                  onCommit={(v) => logDiff(id, v)}
                />
              ))}
            </div>
            <div className="row">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="room-pill" onClick={() => preset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" disabled={!draft} onClick={save}>
                이 곡에 저장
              </button>
              <button type="button" className="btn btn-sm" onClick={revert}>
                프로필 값으로 되돌리기
              </button>
            </div>
            <p className="small muted" style={{ margin: 0 }} role="status">
              {draft ? '아직 저장하지 않았어요. 지금은 미리 듣는 중이에요.' : profile.songOverrides[song] ? '이 곡에 저장한 크기를 쓰고 있어요.' : '프로필 값을 쓰고 있어요.'}
            </p>
          </div>

          <div className="stack">
            <h3 style={{ margin: 0 }}>저음 도움</h3>
            <div className="row" role="group" aria-label="저음 도움">
              {assists.map((a) => (
                <Chip key={a.v} pressed={profile.bassAssist === a.v} onClick={() => updateProfile({ bassAssist: a.v })}>
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <Chip pressed={profile.soloLoudnessMatch} onClick={() => updateProfile({ soloLoudnessMatch: !profile.soloLoudnessMatch })}>
              솔로 크기 맞춤
            </Chip>
            <Chip pressed={st.bypass} onClick={() => engine.setBypass(!st.bypass)}>
              원래 소리
            </Chip>
            <Chip
              pressed={blind}
              onClick={() => {
                onBlind(!blind);
                logEvent({ type: 'blind', value: !blind ? 'on' : 'off' });
              }}
            >
              눈 가리고 듣기
            </Chip>
            {blind && !revealed && (
              <button type="button" className="btn btn-sm" onClick={onReveal}>공개</button>
            )}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {st.bypass ? '보정을 잠시 끄고 원본을 들어요.' : '[원래 소리]를 켜면 보정을 잠시 끄고 원본을 들어요.'}
            {' '}솔로 크기 맞춤은 혼자 들을 때 소리를 합주 크기에 가깝게 맞춰요.
          </p>
        </div>
      )}
    </section>
  );
}
