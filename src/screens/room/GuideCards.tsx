import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { logEvent } from '../../store/log';
import type { CardAnswer, InstrumentId, SongId } from '../../types';
import { ko, tx } from '../../i18n';

interface Card {
  id: string;
  text: string;
  tone: 'lavender' | 'peach' | 'ochre' | 'mint';
  action?: 'trumpet' | 'cajon' | 'alternate' | 'line3';
}

const HBD_CARDS: Card[] = [
  { id: 'hbd-1', get text() { return tx('트럼펫만 켜 보세요. 멜로디를 따라갈 수 있나요?', 'Turn on only the trumpet. Can you follow the melody?'); }, tone: 'lavender', action: 'trumpet' },
  { id: 'hbd-2', get text() { return tx('카혼만 켜 보세요. 가운데를 치는 "쿵"과 가장자리를 치는 "탁"이 구별되나요?', 'Turn on only the cajon. Can you tell the deep "boom" from the center and the sharp "tak" from the edge?'); }, tone: 'peach', action: 'cajon' },
  { id: 'hbd-3', get text() { return tx('베이스를 켰다 껐다 하며 번갈아 들어 보세요. 무엇이 달라지나요?', 'Turn the bass on and off and listen to both. What changes?'); }, tone: 'ochre', action: 'alternate' },
  { id: 'hbd-4', get text() { return tx('3줄을 반복해 보세요. 멜로디가 크게 뛰어오르는 곳이 있어요. 느껴지나요?', 'Loop line 3. The melody makes a big jump up there. Can you feel it?'); }, tone: 'mint', action: 'line3' },
  { id: 'hbd-5', get text() { return tx('다시 모두 함께 들으면서, 아까 혼자 들었던 악기를 찾아보세요.', 'Listen all together again, and try to find the instruments you heard alone.'); }, tone: 'lavender' },
];
const GENERIC_CARDS: Card[] = [
  { id: 'gen-1', get text() { return tx('트럼펫만 켜 보세요. 멜로디를 따라갈 수 있나요?', 'Turn on only the trumpet. Can you follow the melody?'); }, tone: 'lavender', action: 'trumpet' },
  { id: 'gen-2', get text() { return tx('카혼만 켜 보세요. 박자를 따라갈 수 있나요?', 'Turn on only the cajon. Can you follow the beat?'); }, tone: 'peach', action: 'cajon' },
  { id: 'gen-5', get text() { return tx('다시 모두 함께 들으면서, 아까 혼자 들었던 악기를 찾아보세요.', 'Listen all together again, and try to find the instruments you heard alone.'); }, tone: 'lavender' },
];

const ANSWERS: { v: CardAnswer; label: string }[] = [
  { v: 'heard', get label() { return tx('들렸어요', 'I heard it'); } },
  { v: 'some', get label() { return tx('조금', 'Somewhat'); } },
  { v: 'unsure', get label() { return tx('잘 모르겠어요', 'Not sure'); } },
  { v: 'close', get label() { return tx('닫기', 'Close'); } },
];

export function GuideCards({ song, onSolo }: { song: SongId; onSolo: (id: InstrumentId) => void }) {
  const cards = song === 'hbd' ? HBD_CARDS : GENERIC_CARDS;
  const [i, setI] = useState(0);
  const st = useEngineState();
  const card = cards[i];

  if (!card) {
    return (
      <section className="card card-soft" aria-label={tx('안내', 'Guide')}>
        <p style={{ margin: 0 }}>{tx('안내 카드를 모두 봤어요.', 'You have seen all the guide cards.')}</p>
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setI(0)}>
          {tx('처음부터 다시 보기', 'Start over')}
        </button>
      </section>
    );
  }

  const answer = (a: CardAnswer) => {
    logEvent({ type: 'card', cardId: card.id, answer: a });
    if (card.action === 'alternate') engine.stopAlternate();
    setI(i + 1);
  };
  const alt = st.alternating === 'bass';

  return (
    <section className={`card card-tone ${card.tone} stack`} aria-label={tx('안내 카드', 'Guide card')}>
      <p className="small" style={{ margin: 0, fontWeight: 600 }}>{tx(ko`안내 ${i + 1} / ${cards.length} · 정답은 없어요`, `Guide ${i + 1} of ${cards.length} · There is no right answer`)}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{card.text}</p>
      <div className="row">
        {card.action === 'trumpet' && <button type="button" className="btn btn-sm" onClick={() => onSolo('trumpet')}>{tx('트럼펫만 켜기', 'Trumpet only')}</button>}
        {card.action === 'cajon' && <button type="button" className="btn btn-sm" onClick={() => onSolo('cajon')}>{tx('카혼만 켜기', 'Cajon only')}</button>}
        {card.action === 'alternate' && (
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={alt}
            onClick={() => {
              if (alt) engine.stopAlternate();
              else {
                engine.startAlternate('bass');
                logEvent({ type: 'alternate', instrument: 'bass', song });
                if (!st.playing) engine.play();
              }
            }}
          >
            {alt ? tx('번갈아 듣기 멈춤', 'Stop switching') : tx('번갈아 듣기 시작', 'Start switching')}
          </button>
        )}
        {card.action === 'line3' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const sec = engine.sections(song).find((s) => s.id === 'line3');
              if (!sec) return;
              engine.setSection(sec, true);
              logEvent({ type: 'loop', section: sec.id, song });
              engine.play(sec.start);
            }}
          >
            {tx('3줄 반복하기', 'Loop line 3')}
          </button>
        )}
      </div>
      <div className="row" role="group" aria-label={tx('응답', 'Your answer')}>
        {ANSWERS.map((a) => (
          <button key={a.v} type="button" className="btn btn-sm" onClick={() => answer(a.v)}>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
