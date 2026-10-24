// 정보 페이지 (구성안 0절, 2절, 5.3절, 8.2절 요약)
import { Link } from 'react-router-dom';
import { SONGS } from '../config/songs';
import { getLang, tx } from '../i18n';
import './settings.css';

export default function About() {
  const en = getLang() === 'en';
  return (
    <main className="page page-narrow stack-lg">
      <h1>{tx('이 앱은 무엇인가요?', 'What is this app?')}</h1>

      <div className="card card-tone peach stack" role="note">
        <h2>{tx('지금은 시험판이에요', 'This is a test version')}</h2>
        <p>
          {en ? (
            <>
              The instrument recordings are not in yet. So <strong>you will hear a "shhh" noise (pink noise) instead of instrument sounds</strong>. The
              rhythm and loudness follow the song, but there is no pitch. Right now we are trying out the screens and the order of steps first.
            </>
          ) : (
            <>
              아직 악기 녹음이 들어오지 않았어요. 그래서 <strong>악기 소리 대신 '쉬—' 하는 잡음(핑크노이즈)</strong>이 나요. 박자와 크기는 곡을
              따르지만 음높이는 없어요. 지금은 화면과 진행 순서를 먼저 써 보는 단계예요.
            </>
          )}
        </p>
      </div>

      <section className="card stack" aria-labelledby="ab-goal">
        <h2 id="ab-goal" className="about-h">{tx('무엇을 하는 앱인가요', 'What the app does')}</h2>
        <p>
          {tx(
            '인공와우를 쓰는 분이 피아노·카혼·트럼펫·베이스 4인조의 연주를, 그림으로 된 합주실에서 직접 눌러 보며 듣는 웹 앱이에요. 연주자 그림을 누르면 그 악기만 들리고, 다시 누르면 모두 함께 들려요.',
            'This web app is for people who use a cochlear implant (CI). You listen to a 4-piece band (piano, cajon, trumpet, bass) in a drawn Ensemble Room and tap to explore. Tap a player to hear only that instrument. Tap again to hear all together.',
          )}
        </p>
        <p>
          {en ? (
            <>
              The goal is not to make you hear like a hearing person. <strong>It is to help you notice for yourself which sound cues really help you
              when you listen to music, and to enjoy music more actively.</strong> There are no right answers and no scores.
            </>
          ) : (
            <>
              목표는 청인처럼 듣게 만드는 것이 아니에요. <strong>음악을 들을 때 나에게 실제로 도움이 되는 소리 단서가 무엇인지 스스로 알아차리고,
              음악을 더 적극적으로 즐기도록 돕는 것</strong>이에요. 정답과 점수는 없어요.
            </>
          )}
        </p>
      </section>

      <section className="card stack" aria-labelledby="ab-loop">
        <h2 id="ab-loop" className="about-h">{tx('이렇게 이어져요', 'How it flows')}</h2>
        <ol className="about-list">
          <li><strong>{tx('소리 맞추기', 'Sound setup')}</strong>: {tx('내 귀에 편한 소리를 골라요. 3–5분 걸리고, 시험이 아니에요. 언제든 바꿀 수 있어요.', 'Pick the sound that feels comfortable to you. It takes 3–5 minutes and it is not a test. You can change it at any time.')}</li>
          <li><strong>{tx('합주실', 'Ensemble Room')}</strong>: {tx('악기 그림을 눌러 한 악기만 듣거나, 그림을 보며 듣거나, 다시 들어요.', 'Tap an instrument to hear it alone, listen while watching the pictures, or listen again.')}</li>
          <li><strong>{tx('잠깐 질문', 'Quick questions')}</strong>: {tx('"얼마나 달라요?", "어느 쪽이 더 또렷해요?" 같은 정답 없는 질문이에요.', 'Questions with no right answer, like "How different are they?" or "Which one is clearer?"')}</li>
          <li><strong>{tx('나의 청취 단서', 'My Listening Cues')}</strong>: {tx('내가 느낀 것, 고른 것, 말한 것, 합주실에서 한 것을 나란히 보여 줘요.', 'Shows what you felt, what you picked, what you said, and what you did in the room, side by side.')}</li>
        </ol>
        <p>
          <Link to="/calibrate" className="btn">{tx('소리 맞추기 시작', 'Start sound setup')}</Link>
        </p>
      </section>

      <section className="card stack" aria-labelledby="ab-not">
        <h2 id="ab-not" className="about-h">{tx('하지 않는 것', 'What we do not claim')}</h2>
        <ul className="about-list">
          <li>{tx('듣기 능력이 좋아진다고 말하지 않아요. 몇 주 동안 몇 명만으로는 알 수 없어요.', 'We do not say your hearing will improve. A few weeks with a few people cannot show that.')}</li>
          <li>{tx('"나의 청취 단서"가 내 단서를 정확히 잰다고 말하지 않아요. 이번에 들은 결과의 경향일 뿐이에요.', 'We do not say "My Listening Cues" measures your cues exactly. It only shows a tendency from this listening session.')}</li>
          <li>{tx('그림이 듣기를 돕는다고 말하지 않아요. 시험 운영에서 그림을 켜고 꺼 보며 알아볼 부분이에요.', 'We do not say the pictures help you hear. We will look into this in the pilot by turning the pictures on and off.')}</li>
          <li>{tx('기본 설정이 정답이라고 말하지 않아요. 시작점일 뿐이고, 언제든 원래 소리로 돌아갈 수 있어요.', 'We do not say the default settings are right. They are only a starting point, and you can go back to the original sound at any time.')}</li>
          <li>{tx('점수, 등급, "정상"과의 비교, "틀렸어요"라는 말을 쓰지 않아요.', 'We do not use scores, grades, comparisons with "normal," or words like "wrong."')}</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-rec">
        <h2 id="ab-rec" className="about-h">{tx('소리는 이렇게 만들 예정이에요', 'How we plan to make the sounds')}</h2>
        <ul className="about-list">
          <li>{tx('피아노, 카혼, 트럼펫, 베이스(줄을 손가락으로 튕기는 콘트라베이스) 4인조예요.', 'A 4-piece band: piano, cajon, trumpet, and bass (a double bass played by plucking the strings).')}</li>
          <li>{tx('악기마다 따로 녹음해서 하나씩 들을 수 있게 해요.', 'Each instrument is recorded separately, so you can hear them one at a time.')}</li>
          <li>{tx('울림이 거의 없는 방에서 녹음하고, 소리가 시작되는 순간을 깎지 않아요. 소리 크기를 눌러 주는 처리(압축)도 하지 않아요.', 'We record in a room with almost no echo, and we do not cut the moment each note starts. We also do not squeeze the loudness (no compression).')}</li>
          <li>{tx('악기마다 크기를 똑같이 맞춰서, 큰 소리가 더 잘 들리는 일이 없게 해요.', 'All instruments are set to the same loudness, so no instrument stands out just because it is louder.')}</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-songs">
        <h2 id="ab-songs" className="about-h">{tx('곡', 'Songs')}</h2>
        <ul className="about-list">
          <li>{en ? <>Song 1: “{SONGS.hbd.title}”</> : <>곡 1: 「{SONGS.hbd.title}」</>}</li>
          <li>{tx('곡 2: 아직 정해지지 않았어요.', 'Song 2: Not decided yet.')}</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-evidence">
        <h2 id="ab-evidence" className="about-h">{tx('근거는 이 정도예요', 'What the evidence says')}</h2>
        <p className="small muted">{tx('대괄호 속 번호는 팀 구성안의 참고문헌 번호예요. 대부분 소규모 연구이고, 직접 확인되지 않은 부분은 "추정"이라고 적었어요.', 'Numbers in square brackets refer to the reference list in our team plan. Most are small studies. Parts not directly confirmed are marked "Estimate."')}</p>
        <ul className="about-list">
          <li>{tx('인공와우 사용자가 좋아하는 소리는 사람마다 크게 달라서, 소리를 직접 맞추게 해요 [1][3][4][6].', 'The sounds CI users like differ a lot from person to person, so you set up the sound yourself [1][3][4][6].')}</li>
          <li>{tx('악기가 적고 서로 겹치지 않을수록 듣기 쉽다는 보고가 있어서 4인조로 작게 꾸렸어요 [68][63].', 'Studies report that music is easier to follow with fewer instruments that do not overlap, so we kept the band small, with four players [68][63].')}</li>
          <li>{tx('정답 없는 질문(차이 표시하기, 둘 중 고르기)으로도 여러 사람의 단서 경향은 엿볼 수 있어요 [29][31]. 이 앱처럼 짧게 줄인 방식도 믿을 만한지는 아직 확인되지 않았어요.', 'Questions with no right answer (rating a difference, picking one of two) can still show cue tendencies across many people [29][31]. It is not yet confirmed whether a short version like this app is reliable.')}</li>
          <li>{tx('그림을 함께 보면 더 즐겁게 참여한다는 근거는 있지만, 듣기가 좋아진다는 근거는 없고 반대 결과도 있어요 [83][85].', 'There is evidence that pictures make taking part more enjoyable, but no evidence that they improve hearing, and some results show the opposite [83][85].')}</li>
          <li>{tx('설정 값 대부분은 설계하면서 정한 값이에요. 시험 운영에서 확인할 예정이에요.', 'Most setting values were chosen during design. We plan to check them in the pilot.')}</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-who">
        <h2 id="ab-who" className="about-h">{tx('만든 사람', 'Who made this')}</h2>
        <p>{tx('오디오 전공 학생 4명이 만들고 있어요.', 'Four audio engineering students are making this app.')}</p>
      </section>

      <section className="card stack" aria-labelledby="ab-priv">
        <h2 id="ab-priv" className="about-h">{tx('개인정보', 'Privacy')}</h2>
        <p>
          {en ? (
            <>
              We do not ask for your name or contact details. Your settings, records, and answers are saved <strong>only on this device</strong>. They
              are sent to the research team’s server only if you agree to join the study, and exported to a file only when you press Export yourself.
              You can delete everything in Settings at any time.
            </>
          ) : (
            <>
              이름이나 연락처를 받지 않아요. 설정, 기록, 답은 <strong>이 기기 안에만</strong> 저장돼요. 연구 참여에 동의한 경우에만 연구팀 서버로 보내고,
              파일로 내보내기도 직접 누를 때만 해요. 설정에서 언제든 모두 지울 수 있어요.
            </>
          )}
        </p>
        <p>
          <Link to="/settings" className="btn">{tx('설정으로 가기', 'Go to Settings')}</Link>
        </p>
      </section>
    </main>
  );
}
