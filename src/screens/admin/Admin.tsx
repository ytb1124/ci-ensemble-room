// 관리자 문구 수정(#/admin). 사이트의 한국어 문구를 하나씩 고친다. 영어 문구는 다루지 않는다.
// 목록은 소스의 tx() 호출에서 빌드할 때 뽑고(scripts/ko-catalog.ts), 고친 문구는 서버(text_overrides)에 저장한다.
// 이 화면은 한국어 전용이라 tx()를 쓰지 않는다.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import catalog from 'virtual:ko-catalog';
import { overridesEnabled, useOverrides, type Overrides } from '../../store/textOverrides';
import {
  ADMINS, adminName, deleteOverride, errText, fetchHistory, fetchOverrides, getSession, saveOverride, signIn, signOut, type HistoryItem,
} from './adminApi';
import { SCREEN_ORDER, hiddenLabel, screenOf } from './screens';
import './admin.css';

type Entry = (typeof catalog)[number];
type Auth =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; userId: string; email: string; name: string | null };
type Filter = 'all' | 'edited' | 'vars';

/** 문구가 나오는 화면 이름들(겹치지 않게) */
const screensOf = (e: Entry) => [...new Set(e.where.map((p) => screenOf(p).name))];

/** 변수 자리 검사. 없는 번호는 화면에 {3}처럼 그대로 보이므로 막고, 빠진 자리는 알려만 준다 */
function checkVars(text: string, vars: number): { error: string | null; missing: number[] } {
  if (!text.trim()) return { error: '비워 둘 수 없어요.', missing: [] };
  const used = [...text.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]);
  const bad = used.filter((n) => n >= vars);
  if (bad.length) {
    return {
      error: vars ? `{${bad[0]}} 자리는 없어요. {0}${vars > 1 ? `–{${vars - 1}}` : ''}만 쓸 수 있어요.` : `이 문구에는 {${bad[0]}} 같은 변수 자리가 없어요.`,
      missing: [],
    };
  }
  const missing = Array.from({ length: vars }, (_, i) => i).filter((i) => !used.includes(i));
  return { error: null, missing };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const rowsFor = (s: string) => Math.min(10, Math.max(1, s.split('\n').length, Math.ceil(s.length / 42)));

export default function Admin() {
  const [auth, setAuth] = useState<Auth>({ status: 'loading' });

  const refresh = async () => {
    try {
      const s = await getSession();
      if (!s) return setAuth({ status: 'out' });
      const name = await adminName(s.user.id);
      if (name) await fetchOverrides();
      setAuth({ status: 'in', userId: s.user.id, email: s.user.email ?? '', name });
    } catch {
      setAuth({ status: 'out' });
    }
  };

  useEffect(() => {
    if (overridesEnabled) void refresh();
  }, []);

  if (!overridesEnabled) {
    return (
      <main className="page page-narrow stack-lg">
        <h1>문구 관리</h1>
        <p>서버(Supabase)가 연결되지 않아 문구를 저장할 수 없어요. <code>.env.local</code>(배포는 저장소 변수)에 서버 주소와 공개 키를 넣어 주세요.</p>
      </main>
    );
  }
  if (auth.status === 'loading') return <main className="page muted">확인하는 중…</main>;
  if (auth.status === 'out') return <Login onDone={refresh} />;
  if (!auth.name) {
    return (
      <main className="page page-narrow stack-lg">
        <h1>문구 관리</h1>
        <div className="card stack">
          <p><strong>{auth.email}</strong> 계정은 아직 관리자가 아니에요.</p>
          <p className="small">'관리자_계정_만들기.sql'을 Supabase SQL Editor에서 실행했는지 확인해 주세요. 이 계정 하나만 등록하려면 아래를 실행해요.</p>
          <pre className="admin-code">{`insert into public.admins (user_id, name) values ('${auth.userId}', '이름');`}</pre>
          <div className="row">
            <button type="button" className="btn" onClick={() => void refresh()}>다시 확인</button>
            <button type="button" className="btn btn-ghost" onClick={() => void signOut().then(refresh)}>로그아웃</button>
          </div>
        </div>
      </main>
    );
  }
  return <Editor name={auth.name} onSignOut={() => void signOut().then(refresh)} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(name, password);
      onDone();
    } catch (err) {
      setError(errText(err) === 'Invalid login credentials' ? '비밀번호가 맞지 않아요.' : errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-narrow stack-lg">
      <h1>문구 관리</h1>
      <p className="muted">이름을 고르고 비밀번호를 넣어 주세요.</p>
      <form className="card stack" onSubmit={submit}>
        <div className="stack admin-label" role="radiogroup" aria-label="관리자 이름">
          이름
          <div className="row">
            {ADMINS.map((a) => (
              <button key={a.name} type="button" role="radio" className="chip" aria-checked={name === a.name} aria-pressed={name === a.name} onClick={() => setName(a.name)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <label className="stack admin-label">
          비밀번호
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !name}>{busy ? '로그인하는 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

function Editor({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const overrides = useOverrides();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const loadHistory = async () => {
    try {
      setHistory(await fetchHistory());
      setHistoryError(null);
    } catch (e) {
      setHistoryError(errText(e));
    }
  };
  useEffect(() => {
    void loadHistory();
  }, []);

  const historyByKey = useMemo(() => {
    const m = new Map<string, HistoryItem[]>();
    for (const h of history) m.set(h.key, [...(m.get(h.key) ?? []), h]);
    return m;
  }, [history]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // 미리보기에 보여 줄 문구. 좁은 화면에서는 미리보기를 열었다 닫는다
  const [selected, setSelected] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dirtyKeys = Object.keys(drafts);
  const editedCount = catalog.filter((e) => e.key in overrides).length;

  // 저장하지 않은 수정이 있으면 창을 닫기 전에 묻는다
  useEffect(() => {
    if (!dirtyKeys.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyKeys.length]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (e: Entry) => {
      if (filter === 'edited' && !(e.key in overrides)) return false;
      if (filter === 'vars' && !e.vars) return false;
      if (!q) return true;
      return [e.key, overrides[e.key] ?? ''].some((s) => s.toLowerCase().includes(q));
    };
    const map = new Map<string, Entry[]>(SCREEN_ORDER.map((n) => [n, []]));
    for (const e of catalog) if (match(e)) map.get(screenOf(e.where[0]).name)?.push(e);
    return [...map].filter(([, list]) => list.length);
  }, [query, filter, overrides]);

  // 코드에서 문구가 바뀌어 더는 쓰이지 않는 수정 기록
  const orphans = useMemo(() => {
    const keys = new Set(catalog.map((e) => e.key));
    return Object.keys(overrides).filter((k) => !keys.has(k));
  }, [overrides]);

  const setDraft = (key: string, value: string) => {
    setNote(null);
    setDrafts((d) => {
      const current = overrides[key] ?? key;
      const { [key]: _drop, ...rest } = d;
      void _drop;
      return value === current ? rest : { ...rest, [key]: value };
    });
  };
  const clearDraft = (key: string) => setDraft(key, overrides[key] ?? key);

  /** 원래 문구와 같게 고치면 수정 기록을 지운다 */
  const persist = async (key: string, value: string) => {
    if (value === key) await deleteOverride(key);
    else await saveOverride(key, value);
  };

  const run = async (fn: () => Promise<void>, okText: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote({ ok: true, text: okText });
    } catch (e) {
      setNote({ ok: false, text: `저장하지 못했어요: ${errText(e)}` });
    } finally {
      setBusy(false);
      void loadHistory();
    }
  };

  const saveOne = (key: string) =>
    run(async () => {
      await persist(key, drafts[key]);
      setDrafts(({ [key]: _drop, ...rest }) => (void _drop, rest));
    }, '저장했어요. 방문자 화면에는 새로고침하면 보여요.');

  const saveAll = () => {
    const byKey = new Map(catalog.map((e) => [e.key, e]));
    const invalid = dirtyKeys.filter((k) => checkVars(drafts[k], byKey.get(k)?.vars ?? 0).error);
    if (invalid.length) {
      setNote({ ok: false, text: `고칠 곳이 있는 문구 ${invalid.length}개는 저장하지 않았어요. 빨간 안내를 확인해 주세요.` });
      return;
    }
    const count = dirtyKeys.length;
    void run(async () => {
      for (const k of dirtyKeys) {
        await persist(k, drafts[k]);
        setDrafts(({ [k]: _drop, ...rest }) => (void _drop, rest));
      }
    }, `${count}개를 저장했어요. 방문자 화면에는 새로고침하면 보여요.`);
  };

  const reset = (key: string) =>
    void run(async () => {
      await deleteOverride(key);
      setDrafts(({ [key]: _drop, ...rest }) => (void _drop, rest));
    }, '원래 문구로 되돌렸어요.');

  const searching = !!query.trim() || filter !== 'all';
  const selectedEntry = selected ? catalog.find((e) => e.key === selected) ?? null : null;
  // 미리보기에는 저장하지 않은 수정까지 합쳐서 보낸다
  const previewMap = useMemo(() => ({ ...overrides, ...drafts }), [overrides, drafts]);

  return (
    <main className="page admin">
      <div className="stack-lg admin-main">
      <div className="row admin-head">
        <div className="stack" style={{ gap: 4, marginRight: 'auto' }}>
          <h1>문구 관리</h1>
          <p className="muted small">{name}(으)로 로그인 · 한국어 문구 {catalog.length}개 중 {editedCount}개 수정됨</p>
        </div>
        <a className="btn btn-sm" href="./#/" target="_blank" rel="noreferrer">사이트 열기</a>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onSignOut}>로그아웃</button>
      </div>

      <div className="card card-soft stack small">
        <p>사이트에 보이는 한국어 문구를 하나씩 고칠 수 있어요. 저장하면 서버에 남고, 방문자는 다음에 열거나 새로고침할 때 바뀐 문구를 봐요.</p>
        <p><code>{'{0}'}</code>, <code>{'{1}'}</code> 같은 자리에는 숫자나 악기 이름이 들어가요. 자리는 옮겨도 되지만 지우면 그 값이 안 보여요.</p>
      </div>

      <section className="admin-group">
        <button type="button" className="admin-group-head" aria-expanded={showLog} onClick={() => setShowLog((v) => !v)}>
          <span aria-hidden="true" className="admin-caret">{showLog ? '▾' : '▸'}</span>
          <h2>수정 기록</h2>
          <span className="tag">{history.length}건</span>
        </button>
        {historyError && <p className="small admin-error">기록을 불러오지 못했어요: {historyError}</p>}
        {showLog && (
          history.length === 0
            ? <p className="small muted">아직 수정한 기록이 없어요.</p>
            : (
              <ol className="admin-log">
                {history.map((h) => (
                  <HistoryLine key={h.id} item={h} showKey onFind={() => { setQuery(h.key); setFilter('all'); }} />
                ))}
              </ol>
            )
        )}
      </section>

      <div className="admin-tools">
        <input
          className="input"
          type="search"
          placeholder="문구 찾기"
          aria-label="문구 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="seg" role="radiogroup" aria-label="보기">
          {([['all', '전체'], ['edited', `수정한 것 ${editedCount}`], ['vars', '변수 있는 것']] as [Filter, string][]).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={filter === v} onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="muted">맞는 문구가 없어요.</p>}

      {groups.map(([name, list]) => {
        const isOpen = searching || !!open[name];
        const edited = list.filter((e) => e.key in overrides).length;
        return (
          <section key={name} className="admin-group">
            <button
              type="button"
              className="admin-group-head"
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [name]: !isOpen }))}
            >
              <span aria-hidden="true" className="admin-caret">{isOpen ? '▾' : '▸'}</span>
              <h2>{name}</h2>
              <span className="tag">{list.length}개</span>
              {edited > 0 && <span className="tag admin-tag-edited">수정 {edited}</span>}
            </button>
            {isOpen && (
              <div className="stack">
                {list.map((e) => (
                  <Row
                    key={e.key}
                    entry={e}
                    value={drafts[e.key] ?? overrides[e.key] ?? e.key}
                    dirty={e.key in drafts}
                    edited={e.key in overrides}
                    history={historyByKey.get(e.key) ?? []}
                    busy={busy}
                    selected={selected === e.key}
                    onSelect={() => setSelected(e.key)}
                    onShow={() => {
                      setSelected(e.key);
                      setPreviewOpen(true);
                    }}
                    onChange={(v) => setDraft(e.key, v)}
                    onSave={() => void saveOne(e.key)}
                    onCancel={() => clearDraft(e.key)}
                    onReset={() => reset(e.key)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {orphans.length > 0 && (
        <section className="card stack">
          <h2>더는 쓰이지 않는 수정 {orphans.length}개</h2>
          <p className="small muted">코드에서 원래 문구가 바뀌어 화면에 나오지 않는 수정 기록이에요. 지워도 돼요.</p>
          {orphans.map((k) => (
            <div key={k} className="admin-orphan">
              <p className="small"><span className="muted">원래:</span> {k}</p>
              <p className="small"><span className="muted">수정:</span> {overrides[k]}</p>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => reset(k)}>지우기</button>
            </div>
          ))}
        </section>
      )}

      </div>

      <Preview
        entry={selectedEntry}
        map={previewMap}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {(dirtyKeys.length > 0 || note) && (
        <div className="admin-bar" role="status">
          {note && <p className={note.ok ? 'admin-ok' : 'admin-error'}>{note.text}</p>}
          {dirtyKeys.length > 0 && (
            <>
              <p style={{ marginRight: 'auto' }}>저장하지 않은 수정 {dirtyKeys.length}개</p>
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setDrafts({})}>모두 취소</button>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={saveAll}>모두 저장</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function Row({
  entry, value, dirty, edited, history, busy, selected, onSelect, onShow, onChange, onSave, onCancel, onReset,
}: {
  entry: Entry;
  value: string;
  dirty: boolean;
  edited: boolean;
  history: HistoryItem[];
  busy: boolean;
  selected: boolean;
  onSelect: () => void;
  onShow: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const { error, missing } = checkVars(value, entry.vars);
  const [showHistory, setShowHistory] = useState(false);
  const last = history[0];
  const id = `ko-${entry.where[0].file.replace(/\W/g, '-')}-${entry.where[0].line}`;
  const hidden = hiddenLabel(entry.where.find((p) => p.hidden)?.hidden);
  return (
    <div
      className={`admin-row${dirty ? ' is-dirty' : edited ? ' is-edited' : ''}${selected ? ' is-selected' : ''}`}
      onFocusCapture={onSelect}
    >
      <div className="row" style={{ gap: 6 }}>
        {edited && <span className="tag admin-tag-edited">수정됨</span>}
        {dirty && <span className="tag admin-tag-dirty">저장 안 함</span>}
        {last && <span className="small admin-last">{last.changed_by_name ?? '알 수 없음'} · {when(last.changed_at)}</span>}
        <span className="small admin-where" title={entry.where.map((p) => `${p.file}:${p.line}`).join('\n')}>
          {screensOf(entry).join(' · ')}
        </span>
        <button type="button" className="admin-link small admin-show" onClick={onShow}>화면 보기</button>
      </div>
      {hidden && <p className="small admin-hidden">{hidden}</p>}
      {(edited || dirty) && (
        <p className="small admin-orig"><span className="muted">원래 문구:</span> {entry.key}</p>
      )}
      <label htmlFor={id} className="sr-only">한국어 문구</label>
      <textarea
        id={id}
        className="input admin-text"
        rows={rowsFor(value)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="small admin-error">{error}</p>}
      {!error && missing.length > 0 && (
        <p className="small admin-warn">{missing.map((n) => `{${n}}`).join(', ')} 자리가 빠졌어요. 그 값은 화면에 나오지 않아요.</p>
      )}
      {history.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <button type="button" className="admin-history-toggle small" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? '▾' : '▸'} 수정 기록 {history.length}건
          </button>
          {showHistory && (
            <ol className="admin-log">
              {history.map((h) => <HistoryLine key={h.id} item={h} original={entry.key} />)}
            </ol>
          )}
        </div>
      )}
      {(dirty || edited) && (
        <div className="row">
          {dirty && <button type="button" className="btn btn-sm btn-primary" disabled={busy || !!error} onClick={onSave}>저장</button>}
          {dirty && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={onCancel}>취소</button>}
          {edited && !dirty && <button type="button" className="btn btn-sm" disabled={busy} onClick={onReset}>원래 문구로</button>}
        </div>
      )}
    </div>
  );
}

/** 기록 한 줄: 누가, 언제, 무엇에서 무엇으로 */
function HistoryLine({ item, original, showKey, onFind }: { item: HistoryItem; original?: string; showKey?: boolean; onFind?: () => void }) {
  const orig = original ?? item.key;
  const from = item.old_value ?? orig;
  const to = item.new_value ?? orig;
  const action = item.new_value === null ? '원래 문구로 되돌림' : item.old_value === null ? '처음 수정' : '수정';
  return (
    <li className="admin-log-item small">
      <p>
        <strong>{item.changed_by_name ?? '알 수 없음'}</strong>
        <span className="muted"> · {when(item.changed_at)} · {action}</span>
      </p>
      {showKey && (
        <p className="muted admin-orig">
          문구: {orig.length > 60 ? orig.slice(0, 60) + '…' : orig}{' '}
          {onFind && <button type="button" className="admin-link" onClick={onFind}>이 문구 찾기</button>}
        </p>
      )}
      <p className="admin-diff"><del>{from}</del></p>
      <p className="admin-diff"><ins>{to}</ins></p>
    </li>
  );
}

/** 미리보기: 실제 사이트를 작은 창으로 열어 고르는 문구가 나오는 화면을 보여 주고, 그 문구를 분홍 테두리로 표시한다 */
function Preview({ entry, map, open, onClose }: { entry: Entry | null; map: Overrides; open: boolean; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  const [wide, setWide] = useState(false);
  const [placeIdx, setPlaceIdx] = useState(0);

  const places = entry ? [...new Map(entry.where.map((p) => [screenOf(p).name, p])).values()] : [];
  const place = places[Math.min(placeIdx, places.length - 1)];
  const screen = place ? screenOf(place) : null;
  const text = entry ? map[entry.key] ?? entry.key : null;

  const post = (msg: object) => frame.current?.contentWindow?.postMessage({ type: 'cihall-preview', ...msg }, location.origin);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'cihall-preview-ready') setReady(true);
      if (e.data?.type === 'cihall-preview-result') setFound(e.data.found as number);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => setPlaceIdx(0), [entry?.key]);

  // 문구 목록(저장 안 한 수정 포함)
  useEffect(() => {
    if (ready) post({ overrides: map });
  }, [ready, map]);

  // 고른 문구의 화면으로 옮기고 표시한다
  useEffect(() => {
    if (!ready) return;
    const win = frame.current?.contentWindow;
    if (screen && win && win.location.hash.replace(/^#/, '') !== screen.route) win.location.hash = screen.route;
    setFound(null);
    post({ highlight: text ? { text } : null });
  }, [ready, entry?.key, screen?.route, text]);

  const status = !entry
    ? '왼쪽에서 문구를 고르면 그 문구가 나오는 화면을 여기에 보여 줘요.'
    : found === null
      ? '화면에서 찾는 중…'
      : found > 0
        ? `분홍 테두리로 표시했어요${found > 1 ? ` (${found}곳)` : ''}.`
        : '지금 화면에는 안 보여요. 버튼을 누르거나 다음으로 넘어가야 나오는 문구예요. 미리보기 안에서 직접 눌러 보면 나타날 때 표시돼요.';

  return (
    <aside className={`admin-preview${open ? ' is-open' : ''}`} aria-label="화면 미리보기">
      <div className="admin-preview-head">
        <div className="stack" style={{ gap: 2, marginRight: 'auto', minWidth: 0 }}>
          <h2>{screen?.name ?? '화면 미리보기'}</h2>
          {screen && <p className="small muted">주소 #{screen.route}</p>}
        </div>
        <div className="seg" role="radiogroup" aria-label="미리보기 크기">
          <button type="button" role="radio" aria-checked={!wide} onClick={() => setWide(false)}>휴대폰</button>
          <button type="button" role="radio" aria-checked={wide} onClick={() => setWide(true)}>넓게</button>
        </div>
        <button type="button" className="btn btn-sm btn-ghost admin-preview-close" onClick={onClose}>닫기</button>
      </div>
      {places.length > 1 && (
        <div className="row" role="radiogroup" aria-label="나오는 화면">
          {places.map((p, i) => (
            <button key={screenOf(p).name} type="button" role="radio" className="chip" aria-checked={i === placeIdx} aria-pressed={i === placeIdx} onClick={() => setPlaceIdx(i)}>
              {screenOf(p).name}
            </button>
          ))}
        </div>
      )}
      <p className={`small${entry && found === 0 ? ' admin-warn' : ' muted'}`} role="status">{status}</p>
      <div className="admin-preview-frame">
        <iframe
          ref={frame}
          name="cihall-preview"
          title="사이트 미리보기"
          src="./#/"
          style={{ width: wide ? '100%' : 390 }}
        />
      </div>
      <p className="small muted">미리보기에는 저장하지 않은 수정도 바로 보여요. 미리보기 안에서 누른 것은 이 기기의 기록에 남을 수 있어요.</p>
    </aside>
  );
}
