// 정보 페이지 (구성안 0절, 2절, 5.3절, 8.2절 요약)
import { Link } from 'react-router-dom';
import { SONGS } from '../config/songs';
import './settings.css';

export default function About() {
  return (
    <main className="page page-narrow stack-lg">
      <h1>이 프로그램은 무엇인가요?</h1>

      <div className="card card-tone peach stack" role="note">
        <h2>지금은 시험판이에요</h2>
        <p>
          아직 악기 녹음이 들어오지 않았어요. 그래서 <strong>악기 소리 대신 핑크노이즈(치익 하는 잡음)</strong>가 나요. 박자와 크기는 곡을
          따르지만 음높이는 없어요. 화면과 흐름을 먼저 써 보는 단계예요.
        </p>
      </div>

      <section className="card stack" aria-labelledby="ab-goal">
        <h2 id="ab-goal" className="about-h">무엇을 하는 프로그램인가요</h2>
        <p>
          인공와우(CI)를 쓰는 분이 피아노·카혼·트럼펫·베이스 4인조가 연주하는 노래를 그림으로 된 합주실에서 직접 만져 보며 듣는 웹
          프로그램이에요. 연주자 그림을 누르면 그 악기만 들리고, 다시 누르면 합주로 돌아와요.
        </p>
        <p>
          목표는 정상 청력처럼 듣게 만드는 것이 아니에요. <strong>"나에게 실제로 쓸모 있는 소리 단서는 무엇인가"를 스스로 알아차리고,
          음악을 더 능동적으로 듣도록 돕는 것</strong>이에요. 정답과 점수는 없어요.
        </p>
      </section>

      <section className="card stack" aria-labelledby="ab-loop">
        <h2 id="ab-loop" className="about-h">이렇게 이어져요</h2>
        <ol className="about-list">
          <li><strong>보정</strong>: 내 귀에 맞게 소리 맞추기. 3–5분이고 시험이 아니에요. 언제든 바꿀 수 있어요.</li>
          <li><strong>합주실</strong>: 악기 그림을 눌러 혼자 듣고, 보며 듣고, 다시 들어요.</li>
          <li><strong>단서 질문</strong>: 정답 없는 잠깐 질문. "얼마나 달라요?", "어느 쪽이 더 또렷해요?"</li>
          <li><strong>나의 청취 단서</strong>: 느낀 것·고른 것·말한 것·한 것을 나란히 보여 줘요.</li>
        </ol>
        <p>
          <Link to="/calibrate" className="btn">보정 시작하기</Link>
        </p>
      </section>

      <section className="card stack" aria-labelledby="ab-not">
        <h2 id="ab-not" className="about-h">하지 않는 것</h2>
        <ul className="about-list">
          <li>듣기 능력이 좋아진다고 주장하지 않아요. 몇 주, 몇 명으로는 보일 수 없어요.</li>
          <li>"나의 청취 단서"가 내 단서를 정확히 재 준다고 주장하지 않아요. 이번 세션의 경향일 뿐이에요.</li>
          <li>그림(시각화)이 듣기를 돕는다고 주장하지 않아요. 파일럿에서 켜고 꺼 보며 알아볼 가설이에요.</li>
          <li>기본 설정이 맞다고 주장하지 않아요. 출발점이고, 언제든 원래 소리로 돌아갈 수 있어요.</li>
          <li>점수, 등급, "정상"과의 비교, "틀렸어요"라는 말을 쓰지 않아요.</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-rec">
        <h2 id="ab-rec" className="about-h">소리는 이렇게 만들 예정이에요</h2>
        <ul className="about-list">
          <li>피아노, 카혼, 트럼펫, 베이스(콘트라베이스, 줄을 튕기는 피치카토) 4인조예요.</li>
          <li>악기마다 따로 녹음해서 하나씩 들을 수 있게 해요.</li>
          <li>잔향 없는 소리(드라이)로 녹음하고, 시작 소리(어택)를 깎지 않아요. 압축·리미터를 쓰지 않아요.</li>
          <li>악기마다 같은 크기로 맞춰서, 큰 소리가 이기는 일이 없게 해요.</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-songs">
        <h2 id="ab-songs" className="about-h">곡</h2>
        <ul className="about-list">
          <li>곡 1: 「{SONGS.hbd.title}」</li>
          <li>곡 2: 아직 정해지지 않았어요.</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-evidence">
        <h2 id="ab-evidence" className="about-h">근거는 이 정도예요</h2>
        <p className="small muted">대괄호 번호는 구성안 참고문헌 번호예요. 대부분 작은 연구이고 직접 확인되지 않은 부분은 "추정"이라고 적었어요.</p>
        <ul className="about-list">
          <li>인공와우 사용자의 재생 선호는 사람마다 크게 달라서, 소리를 직접 맞추게 해요 [1][3][4][6].</li>
          <li>악기가 적고 서로 겹치지 않을수록 듣기 쉽다는 보고가 있어서 3인조로 해요 [68][63].</li>
          <li>정답 없는 평정과 선택으로도 집단 수준의 단서 경향은 엿볼 수 있어요 [29][31]. 이 프로그램의 짧은 버전이 믿을 만한지는 검증되지 않았어요.</li>
          <li>시각화는 참여와 선호의 근거는 있지만 듣기가 좋아진다는 근거는 없고, 반대 신호도 있어요 [83][85].</li>
          <li>설정 값 대부분은 설계할 때 정한 값(추론)이에요. 파일럿에서 확인할 예정이에요.</li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="ab-who">
        <h2 id="ab-who" className="about-h">만든 사람</h2>
        <p>오디오 전공 학생 4명이 만들고 있어요.</p>
      </section>

      <section className="card stack" aria-labelledby="ab-priv">
        <h2 id="ab-priv" className="about-h">개인정보</h2>
        <p>
          이름이나 연락처를 받지 않아요. 설정, 기록, 응답은 <strong>이 기기 안에만</strong> 저장돼요. 서버로 보내지 않고, 파일로 내보내는 것도
          직접 누를 때만 해요. 설정에서 언제든 모두 지울 수 있어요.
        </p>
        <p>
          <Link to="/settings" className="btn">설정으로</Link>
        </p>
      </section>
    </main>
  );
}
