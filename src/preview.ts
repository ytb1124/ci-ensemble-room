// 관리자 문구 수정 화면(#/admin)의 미리보기 창 쪽 코드. 사이트를 iframe(name="cihall-preview")으로 열었을 때만 동작한다.
// 관리자 화면이 보내는 메시지:
//   { type: 'cihall-preview', overrides } → 저장 안 한 수정까지 합친 문구로 다시 그린다
//   { type: 'cihall-preview', highlight: { text } | null } → 그 문구를 화면에서 찾아 분홍 테두리로 표시한다
// 찾은 개수는 { type: 'cihall-preview-result', found }로 돌려준다.
import { overridesStore, type Overrides } from './store/textOverrides';

const HL = 'cihall-preview-hl';
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

let needle: string | null = null;
let lastFound = -1;

/** 변수 자리({0})를 뺀 가장 긴 조각. 화면에서는 변수 자리에 숫자나 이름이 들어가 있다 */
function needleOf(text: string): string | null {
  const parts = text.split(/\{\d+\}/).map((s) => s.trim()).filter((s) => s.length >= 2);
  return parts.sort((a, b) => b.length - a.length)[0] ?? null;
}

function highlight() {
  document.querySelectorAll('.' + HL).forEach((el) => el.classList.remove(HL));
  const found: Element[] = [];
  if (needle) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (el && n.nodeValue?.includes(needle) && !found.includes(el)) found.push(el);
    }
    // 화면 낭독기용·마우스 올림 문구는 그 속성을 가진 요소를 표시한다
    document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
      if (ATTRS.some((a) => el.getAttribute(a)?.includes(needle!)) && !found.includes(el)) found.push(el);
    });
  }
  found.forEach((el) => el.classList.add(HL));
  // 새로 나타났을 때만 그쪽으로 스크롤한다(관리자가 미리보기 안에서 움직이는 것을 방해하지 않게)
  // scrollIntoView는 바깥 관리자 화면까지 스크롤하므로 이 창 안에서만 움직인다
  if (found.length && lastFound <= 0) {
    const r = found[0].getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - window.innerHeight / 2 + r.height / 2, behavior: 'smooth' });
  }
  if (found.length !== lastFound) window.parent.postMessage({ type: 'cihall-preview-result', found: found.length }, location.origin);
  lastFound = found.length;
}

export function initPreview(): () => void {
  const style = document.createElement('style');
  style.textContent = `.${HL}{outline:3px solid #ff4d8b!important;outline-offset:2px;border-radius:4px;background-color:rgba(255,77,139,.14)!important;}`;
  document.head.appendChild(style);

  let timer: number | null = null;
  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      highlight();
    }, 120);
  };
  // 버튼을 눌러 다음 단계로 가는 등 화면이 바뀌면 다시 찾는다
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin || e.data?.type !== 'cihall-preview') return;
    const d = e.data as { overrides?: Overrides; highlight?: { text: string } | null };
    if (d.overrides) overridesStore.set(d.overrides);
    if ('highlight' in d) {
      needle = d.highlight ? needleOf(d.highlight.text) : null;
      lastFound = -1;
      schedule();
    }
  };
  window.addEventListener('message', onMessage);
  window.parent.postMessage({ type: 'cihall-preview-ready' }, location.origin);
  return () => {
    observer.disconnect();
    window.removeEventListener('message', onMessage);
    style.remove();
  };
}
