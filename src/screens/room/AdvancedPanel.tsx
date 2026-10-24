import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { Chip } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { updateProfile, useProfile } from '../../store/profile';
import { logEvent } from '../../store/log';
import type { BassAssist, SongId } from '../../types';

export function AdvancedPanel({
  song, blind, onBlind, onReveal, revealed,
}: {
  song: SongId; blind: boolean; onBlind: (v: boolean) => void; onReveal: () => void; revealed: boolean;
}) {
  const profile = useProfile();
  const st = useEngineState();
  const [open, setOpen] = useState(false);
  const saved = !!profile.songOverrides[song];
  const revert = () => {
    updateProfile((p) => {
      const so = { ...p.songOverrides };
      delete so[song];
      return { songOverrides: so };
    });
  };
  const assists: { v: BassAssist; label: string }[] = [
    { v: 'none', label: '쓰지 않기' },
    { v: 'boost', label: '저음 키우기' },
    { v: 'octaveUp', label: '베이스를 높게 겹쳐 듣기' },
  ];

  return (
    <section className="card stack" aria-label="더 맞추기">
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="room-adv"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>더 맞추기</span>
        <Icon name="chevronDown" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div id="room-adv" className="stack-lg">
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }} role="status">
              {saved ? '악기 크기는 카드 아래 [−][+]로 바꾸고, 이 곡에 바로 저장돼요.' : '악기 크기는 카드 아래 [−][+]로 바꿔요. 바꾸면 이 곡에 바로 저장돼요.'}
            </p>
            {saved && (
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={revert}>
                  내 기본 설정으로
                </button>
              </div>
            )}
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
              혼자 들어도 같은 크기로
            </Chip>
            <Chip pressed={st.bypass} onClick={() => engine.setBypass(!st.bypass)}>
              보정 없이 비교 듣기
            </Chip>
            <Chip
              pressed={blind}
              onClick={() => {
                onBlind(!blind);
                logEvent({ type: 'blind', value: !blind ? 'on' : 'off' });
              }}
            >
              그림 없이 맞혀 보기
            </Chip>
            {blind && !revealed && (
              <button type="button" className="btn btn-sm" onClick={onReveal}>공개</button>
            )}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {st.bypass ? '지금은 내 설정을 잠시 끄고 원본을 들어요. 다시 누르면 돌아가요.' : '[보정 없이 비교 듣기]를 켜면 내 설정을 잠시 끄고 원본과 비교할 수 있어요.'}
            {' '}[혼자 들어도 같은 크기로]는 한 악기만 들을 때 소리가 작아지지 않게 해 줘요.
          </p>
        </div>
      )}
    </section>
  );
}
