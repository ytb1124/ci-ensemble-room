// localStorage 안전 래퍼. 모든 읽기·쓰기는 try/catch (구성안 9절).
// 저장이 안 되는 환경에서도 앱은 메모리 값으로 계속 동작한다.

export const KEYS = {
  profile: 'cihall.profile.v1',
  log: 'cihall.log.v1',
  probe: 'cihall.probe.v1',
  report: 'cihall.report.v1',
} as const;

let storageOk: boolean | null = null;

export function storageAvailable(): boolean {
  if (storageOk !== null) return storageOk;
  try {
    const k = '__cihall_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageOk = false;
    return false;
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

/** 작은 외부 저장소: 구독 가능한 값. React에서는 useSyncExternalStore로 읽는다 */
export function createStore<T>(initial: T, persist?: (v: T) => void) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      persist?.(value);
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}
