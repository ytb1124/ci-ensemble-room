// 관리자 문구 수정(#/admin). 사이트의 한국어 문구를 하나씩 고친다. 영어 문구는 다루지 않는다.
// 목록은 소스의 tx() 호출에서 빌드할 때 뽑고(scripts/ko-catalog.ts), 고친 문구는 서버(text_overrides)에 저장한다.
// 이 화면은 한국어 전용이라 tx()를 쓰지 않는다.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import catalog from 'virtual:ko-catalog';
import { overridesEnabled, useOverrides } from '../../store/textOverrides';
import { deleteOverride, errText, fetchOverrides, getSession, isAdmin, saveOverride, signIn, signOut } from './adminApi';
import './admin.css';

type Entry = (typeof catalog)[number];
type Auth =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; email: string; userId: string; admin: boolean };
type Filter = 'all' | 'edited' | 'vars';

// 파일 위치로 화면을 나눈다. 위에서부터 처음 맞는 것
const GROUPS: [string, RegExp][] = [
  ['상단 바·공통', /^(App|i18n)\.tsx?$/],
  ['시작 화면', /^screens\/Start\.tsx$/],
  ['처음 설정(보정)', /^screens\/calibrate\//],
  ['합주실', /^screens\/room\//],
  ['단서 질문', /^screens\/probe\//],
  ['나의 청취 단서(리포트)', /^screens\/report\/|^store\/reportRules\.ts$/],
  ['설정', /^screens\/(Settings|ResearchSection)\.tsx$/],
  ['연구 참여', /^screens\/Join\.tsx$|^store\/research\.ts$/],
  ['이 프로그램에 대해', /^screens\/About\.tsx$/],
  ['악기·시각화 부품', /^components\//],
];
const OTHER = '그 밖의 문구';

const groupOf = (e: Entry) => {
  const file = e.where[0].replace(/:\d+$/, '');
  return GROUPS.find(([, r]) => r.test(file))?.[0] ?? OTHER;
};

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

const rowsFor = (s: string) => Math.min(10, Math.max(1, s.split('\n').length, Math.ceil(s.length / 42)));

export default function Admin() {
  const [auth, setAuth] = useState<Auth>({ status: 'loading' });

  const refresh = async () => {
    try {
      const s = await getSession();
      if (!s) return setAuth({ status: 'out' });
      const admin = await isAdmin(s.user.id);
      if (admin) await fetchOverrides();
      setAuth({ status: 'in', email: s.user.email ?? '', userId: s.user.id, admin });
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
  if (!auth.admin) {
    return (
      <main className="page page-narrow stack-lg">
        <h1>문구 관리</h1>
        <div className="card stack">
          <p><strong>{auth.email}</strong> 계정은 아직 관리자가 아니에요.</p>
          <p className="small">Supabase 대시보드 → SQL Editor에서 아래를 한 번 실행하면 관리자가 돼요.</p>
          <pre className="admin-code">{`insert into public.admins (user_id) values ('${auth.userId}');`}</pre>
          <div className="row">
            <button type="button" className="btn" onClick={() => void refresh()}>다시 확인</button>
            <button type="button" className="btn btn-ghost" onClick={() => void signOut().then(refresh)}>로그아웃</button>
          </div>
        </div>
      </main>
    );
  }
  return <Editor email={auth.email} onSignOut={() => void signOut().then(refresh)} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      onDone();
    } catch (err) {
      setError(errText(err) === 'Invalid login credentials' ? '이메일이나 비밀번호가 맞지 않아요.' : errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-narrow stack-lg">
      <h1>문구 관리</h1>
      <p className="muted">관리자 계정으로 로그인해 주세요.</p>
      <form className="card stack" onSubmit={submit}>
        <label className="stack admin-label">
          이메일
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="stack admin-label">
          비밀번호
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '로그인하는 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

function Editor({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const overrides = useOverrides();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

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
      return [e.key, overrides[e.key] ?? '', e.en].some((s) => s.toLowerCase().includes(q));
    };
    const map = new Map<string, Entry[]>();
    for (const name of [...GROUPS.map(([n]) => n), OTHER]) map.set(name, []);
    for (const e of catalog) if (match(e)) map.get(groupOf(e))!.push(e);
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

  return (
    <main className="page stack-lg admin">
      <div className="row admin-head">
        <div className="stack" style={{ gap: 4, marginRight: 'auto' }}>
          <h1>문구 관리</h1>
          <p className="muted small">{email} · 한국어 문구 {catalog.length}개 중 {editedCount}개 수정됨</p>
        </div>
        <a className="btn btn-sm" href="./#/" target="_blank" rel="noreferrer">사이트 열기</a>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onSignOut}>로그아웃</button>
      </div>

      <div className="card card-soft stack small">
        <p>사이트에 보이는 한국어 문구를 하나씩 고칠 수 있어요. 저장하면 서버에 남고, 방문자는 다음에 열거나 새로고침할 때 바뀐 문구를 봐요.</p>
        <p><code>{'{0}'}</code>, <code>{'{1}'}</code> 같은 자리에는 숫자나 악기 이름이 들어가요. 자리는 옮겨도 되지만 지우면 그 값이 안 보여요.</p>
      </div>

      <div className="admin-tools">
        <input
          className="input"
          type="search"
          placeholder="문구 찾기 (한국어·영어 모두)"
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
                    busy={busy}
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
  entry, value, dirty, edited, busy, onChange, onSave, onCancel, onReset,
}: {
  entry: Entry;
  value: string;
  dirty: boolean;
  edited: boolean;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const { error, missing } = checkVars(value, entry.vars);
  const id = `ko-${entry.where[0].replace(/\W/g, '-')}`;
  return (
    <div className={`admin-row${dirty ? ' is-dirty' : edited ? ' is-edited' : ''}`}>
      <div className="row" style={{ gap: 6 }}>
        {edited && <span className="tag admin-tag-edited">수정됨</span>}
        {dirty && <span className="tag admin-tag-dirty">저장 안 함</span>}
        <span className="small muted admin-where" title={entry.where.join('\n')}>
          {entry.where[0]}{entry.where.length > 1 ? ` 외 ${entry.where.length - 1}곳` : ''}
        </span>
      </div>
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
      <p className="small muted admin-en" lang="en"><span>영어:</span> {entry.en}</p>
      {error && <p className="small admin-error">{error}</p>}
      {!error && missing.length > 0 && (
        <p className="small admin-warn">{missing.map((n) => `{${n}}`).join(', ')} 자리가 빠졌어요. 그 값은 화면에 나오지 않아요.</p>
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
