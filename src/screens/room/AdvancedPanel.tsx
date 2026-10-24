import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { Chip } from '../../components/ui/controls';
import { Icon } from '../../components/ui/Icon';
import { updateProfile, useProfile } from '../../store/profile';
import { logEvent } from '../../store/log';
import type { BassAssist, SongId } from '../../types';
import { tx } from '../../i18n';

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
    { v: 'none', label: tx('원래 소리', 'Original sound') },
    { v: 'boost', label: tx('저음 키우기', 'Boost bass') },
    { v: 'octaveUp', label: tx('베이스를 높게 겹쳐 듣기', 'Add bass an octave up') },
  ];

  return (
    <section className="card stack" aria-label={tx('더 맞추기', 'More settings')}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="room-adv"
        onClick={() => setOpen(!open)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>{tx('더 맞추기', 'More settings')}</span>
        <Icon name="chevronDown" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div id="room-adv" className="stack-lg">
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }} role="status">
              {tx('악기 크기는 카드 아래 [−][+]로 바꿔요. 바꾼 크기는 이 곡에 바로 저장돼요.', 'Change instrument volume with [−][+] under each card. Changes are saved for this song right away.')}
            </p>
            {saved && (
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={revert}>
                  {tx('내 기본 설정으로 되돌리기', 'Back to my default settings')}
                </button>
              </div>
            )}
          </div>

          <div className="stack">
            <h3 style={{ margin: 0 }}>{tx('저음 도움', 'Bass help')}</h3>
            <div className="row" role="group" aria-label={tx('저음 도움', 'Bass help')}>
              {assists.map((a) => (
                <Chip key={a.v} pressed={profile.bassAssist === a.v} onClick={() => updateProfile({ bassAssist: a.v })}>
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <Chip pressed={profile.soloLoudnessMatch} onClick={() => updateProfile({ soloLoudnessMatch: !profile.soloLoudnessMatch })}>
              {tx('혼자 들어도 같은 크기로', 'Same volume when solo')}
            </Chip>
            <Chip pressed={st.bypass} onClick={() => engine.setBypass(!st.bypass)}>
              {tx('내 설정 끄고 비교하기', 'Compare without my settings')}
            </Chip>
            <Chip
              pressed={blind}
              onClick={() => {
                onBlind(!blind);
                logEvent({ type: 'blind', value: !blind ? 'on' : 'off' });
              }}
            >
              {tx('악기 이름 가리고 듣기', 'Hide instrument names')}
            </Chip>
            {blind && !revealed && (
              <button type="button" className="btn btn-sm" onClick={onReveal}>{tx('이름 보기', 'Show names')}</button>
            )}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {st.bypass ? tx('지금은 내 설정을 잠시 끄고 원래 소리를 들어요. 다시 누르면 내 설정으로 돌아가요.', 'Your settings are off for now, so you hear the original sound. Press again to go back to your settings.') : tx('[내 설정 끄고 비교하기]를 켜면 원래 소리와 비교할 수 있어요.', 'Turn on [Compare without my settings] to compare with the original sound.')}
            {' '}{tx('[혼자 들어도 같은 크기로]를 켜면 한 악기만 들을 때도 소리가 작아지지 않아요.', 'Turn on [Same volume when solo] so one instrument alone does not sound quieter.')}
          </p>
        </div>
      )}
    </section>
  );
}
