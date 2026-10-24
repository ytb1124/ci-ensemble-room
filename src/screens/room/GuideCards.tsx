import { useState } from 'react';
import { engine, useEngineState } from '../../audio/useEngine';
import { logEvent } from '../../store/log';
import type { CardAnswer, InstrumentId, SongId } from '../../types';

interface Card {
  id: string;
  text: string;
  tone: 'lavender' | 'peach' | 'ochre' | 'mint';
  action?: 'trumpet' | 'cajon' | 'alternate' | 'line3';
}

const HBD_CARDS: Card[] = [
  { id: 'hbd-1', text: '트럼펫만 켜 보세요. 멜로디를 따라갈 수 있나요?', tone: 'lavender', action: 'trumpet' },
  { id: 'hbd-2', text: '카혼만 켜 보세요. 가운데를 치는 "쿵"과 가장자리를 치는 "탁"이 구별되나요?', tone: 'peach', action: 'cajon' },
  { id: 'hbd-3', text: '베이스를 켰다 껐다 하며 번갈아 들어 보세요. 무엇이 달라지나요?', tone: 'ochre', action: 'alternate' },
  { id: 'hbd-4', text: '3줄을 반복해 보세요. 멜로디가 크게 뛰어오르는 곳이 있어요. 느껴지나요?', tone: 'mint', action: 'line3' },
  { id: 'hbd-5', text: '다시 모두 함께 들으면서, 아까 혼자 들었던 악기를 찾아보세요.', tone: 'lavender' },
];
const GENERIC_CARDS: Card[] = [
  { id: 'gen-1', text: '트럼펫만 켜 보세요. 멜로디를 따라갈 수 있나요?', tone: 'lavender', action: 'trumpet' },
  { id: 'gen-2', text: '카혼만 켜 보세요. 박자를 따라갈 수 있나요?', tone: 'peach', action: 'cajon' },
  { id: 'gen-5', text: '다시 모두 함께 들으면서, 아까 혼자 들었던 악기를 찾아보세요.', tone: 'lavender' },
];

const ANSWERS: { v: CardAnswer; label: string }[] = [
  { v: 'heard', label: '들렸어요' },
  { v: 'some', label: '조금' },
  { v: 'unsure', label: '잘 모르겠어요' },
  { v: 'close', label: '닫기' },
];

export function GuideCards({ song, onSolo }: { song: SongId; onSolo: (id: InstrumentId) => void }) {
  const cards = song === 'hbd' ? HBD_CARDS : GENERIC_CARDS;
  const [i, setI] = useState(0);
  const st = useEngineState();
  const card = cards[i];

  if (!card) {
    return (
      <section className="card card-soft" aria-label="안내">
        <p style={{ margin: 0 }}>안내 카드를 모두 봤어요.</p>
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setI(0)}>
          처음부터 다시 보기
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
    <section className={`card card-tone ${card.tone} stack`} aria-label="안내 카드">
      <p className="small" style={{ margin: 0, fontWeight: 600 }}>안내 {i + 1} / {cards.length} · 정답은 없어요</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{card.text}</p>
      <div className="row">
        {card.action === 'trumpet' && <button type="button" className="btn btn-sm" onClick={() => onSolo('trumpet')}>트럼펫만 켜기</button>}
        {card.action === 'cajon' && <button type="button" className="btn btn-sm" onClick={() => onSolo('cajon')}>카혼만 켜기</button>}
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
            {alt ? '번갈아 듣기 멈춤' : '번갈아 듣기 시작'}
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
            3줄 반복하기
          </button>
        )}
      </div>
      <div className="row" role="group" aria-label="응답">
        {ANSWERS.map((a) => (
          <button key={a.v} type="button" className="btn btn-sm" onClick={() => answer(a.v)}>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
