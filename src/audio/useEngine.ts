import { useEffect, useRef, useSyncExternalStore } from 'react';
import { engine, type EngineState } from './engine';

export function useEngineState(): EngineState {
  return useSyncExternalStore(engine.store.subscribe, engine.store.get);
}

/** requestAnimationFrame 루프. 콜백은 매 프레임 engine.songTime() 등을 읽는다 */
export function useAnimationFrame(cb: (dt: number) => void, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      ref.current(now - last);
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

export { engine };
