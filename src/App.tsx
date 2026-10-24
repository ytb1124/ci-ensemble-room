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

// 사이트맵(구성안 3.1절). 정적 호스팅에서도 동작하도록 해시 라우터를 쓴다.

function TopBar() {
  const { pathname } = useLocation();
  // 단서 질문 중에는 다른 곳으로 새지 않게 메뉴를 줄인다
  const minimal = pathname.startsWith('/probe');
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label="인공와우 합주실 처음으로">
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="var(--primary)" />
          <circle cx="24" cy="40" r="9" fill="#ffb084" />
          <rect x="31" y="14" width="5" height="27" rx="2.5" fill="#ffb084" />
          <path d="M36 14c8 2 12 6 12 12" stroke="#ffb084" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
        인공와우 합주실
      </NavLink>
      {!minimal && (
        <nav aria-label="주 메뉴">
          <NavLink to="/room/hbd">합주실</NavLink>
          <NavLink to="/report">나의 청취 단서</NavLink>
          <NavLink to="/settings" aria-label="설정">설정</NavLink>
        </nav>
      )}
    </header>
  );
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
      이 기기에서는 기록이 남지 않아요. 창을 닫으면 설정과 응답이 사라져요.
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
  return (
    <HashRouter>
      <ThemeSync />
      <ScrollTop />
      {/* 해시 라우터와 충돌하지 않도록 href 대신 포커스 이동으로 건너뛴다 */}
      <button
        type="button"
        className="sr-only skip-link"
        onClick={() => document.getElementById('main')?.focus()}
      >
        본문으로 건너뛰기
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
