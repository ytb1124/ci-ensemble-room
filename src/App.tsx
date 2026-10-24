import { useEffect } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ResumeBanner, SoundGate } from './components/SoundGate';
import { useProfile } from './store/profile';
import { storageAvailable } from './store/storage';
import About from './screens/About';
import InstrumentGallery from './components/instruments/InstrumentGallery';
import Calibrate from './screens/calibrate/Calibrate';
import Probe from './screens/probe/Probe';
import Report from './screens/report/Report';
import Room from './screens/room/Room';
import Settings from './screens/Settings';
import Start from './screens/Start';
import Join from './screens/Join';
import { initResearch } from './store/research';
import { Icon } from './components/ui/Icon';
import { setLang, tx, useLang } from './i18n';

// 사이트맵(구성안 3.1절). 정적 호스팅에서도 동작하도록 해시 라우터를 쓴다.

function TopBar() {
  const { pathname } = useLocation();
  // 단서 질문 중에는 다른 곳으로 새지 않게 메뉴를 줄인다
  const minimal = pathname.startsWith('/probe');
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label={tx('인공와우 합주실 처음으로', 'CI Ensemble Room home')}>
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="var(--primary)" />
          <circle cx="24" cy="40" r="9" fill="#ffb084" />
          <rect x="31" y="14" width="5" height="27" rx="2.5" fill="#ffb084" />
          <path d="M36 14c8 2 12 6 12 12" stroke="#ffb084" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
        {tx('인공와우 합주실', 'CI Ensemble Room')}
      </NavLink>
      {!minimal && (
        <nav aria-label={tx('주 메뉴', 'Main menu')}>
          <NavLink to="/room/hbd">{tx('합주실', 'Ensemble Room')}</NavLink>
          <NavLink to="/report">{tx('나의 청취 단서', 'My Listening Cues')}</NavLink>
          <NavLink to="/settings">{tx('설정', 'Settings')}</NavLink>
        </nav>
      )}
      <LangSwitch />
    </header>
  );
}

/** 우측 상단 언어 전환. 지금 언어가 아닌 쪽 이름을 그 언어로 보여 준다 */
function LangSwitch() {
  const lang = useLang();
  const next = lang === 'ko' ? 'en' : 'ko';
  return (
    <button
      type="button"
      className="lang-switch"
      lang={next}
      aria-label={next === 'en' ? 'Switch to English' : '한국어로 바꾸기'}
      onClick={() => setLang(next)}
    >
      <Icon name="globe" size={18} />
      {next === 'en' ? 'English' : '한국어'}
    </button>
  );
}

/** <html lang>과 탭 제목을 지금 언어에 맞춘다 */
function LangSync() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = tx('인공와우 합주실', 'CI Ensemble Room');
  }, [lang]);
  return null;
}

function ThemeSync() {
  const p = useProfile();
  useEffect(() => {
    const el = document.documentElement;
    if (p.viz.theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', p.viz.theme);
  }, [p.viz.theme]);
  return null;
}

function StorageNotice() {
  if (storageAvailable()) return null;
  return (
    <p role="status" className="small" style={{ textAlign: 'center', padding: 8, background: 'var(--surface-strong)', margin: 0 }}>
      {tx('이 기기에서는 기록이 남지 않아요. 창을 닫으면 설정과 답이 사라져요.', "This device can't save your progress. Your settings and answers will be lost when you close this window.")}
    </p>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => initResearch(), []);
  useLang(); // 언어가 바뀌면 전체를 다시 그린다(문구는 tx()가 그릴 때 읽는다)
  return (
    <HashRouter>
      <LangSync />
      <ThemeSync />
      <ScrollTop />
      {/* 해시 라우터와 충돌하지 않도록 href 대신 포커스 이동으로 건너뛴다 */}
      <button
        type="button"
        className="sr-only skip-link"
        onClick={() => document.getElementById('main')?.focus()}
      >
        {tx('본문으로 건너뛰기', 'Skip to main content')}
      </button>
      <TopBar />
      <StorageNotice />
      <ResumeBanner />
      <div id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/calibrate" element={<SoundGate><Calibrate /></SoundGate>} />
          <Route path="/calibrate/:step" element={<SoundGate><Calibrate /></SoundGate>} />
          <Route path="/room/:song" element={<SoundGate><Room /></SoundGate>} />
          <Route path="/room" element={<Navigate to="/room/hbd" replace />} />
          <Route path="/probe/:set" element={<SoundGate><Probe /></SoundGate>} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/join" element={<Join />} />
          {/* 개발용: 악기 UI 모든 상태 보기 */}
          {import.meta.env.DEV && <Route path="/dev/instruments" element={<InstrumentGallery />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
