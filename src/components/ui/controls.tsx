// 공용 컨트롤. 모든 화면은 이 컴포넌트와 index.css의 클래스(.btn .seg .card .chip .tag .range .input)를 쓴다.
import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';

/** pill 세그먼트 컨트롤(DESIGN 0.3: 모드·보기 전환). role=radiogroup */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="row" style={{ gap: 8 }}>
      <span id={id} className={hideLabel ? 'sr-only' : 'small'} style={{ fontWeight: 600, color: 'var(--body-strong)' }}>
        {label}
      </span>
      <div className="seg" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** dB 슬라이더. 값 표시는 글자로 함께 보인다 */
export function DbSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  unit = 'dB',
  formatValue,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const id = useId();
  const shown = formatValue ? formatValue(value) : `${value > 0 ? '+' : ''}${value} ${unit}`;
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor={id} style={{ fontWeight: 600, color: 'var(--body-strong)' }}>
          {label}
        </label>
        <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {shown}
        </span>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}

export function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {pressed && <Icon name="check" size={18} />}
      {children}
    </button>
  );
}

/** A/B 비교 버튼 한 쌍 + "차이를 잘 모르겠어요"(DESIGN 0.3). 선택한 쪽은 테두리 + 체크 아이콘 */
export function ABChoice<T extends string>({
  options,
  value,
  onChange,
  unsureLabel = '차이를 잘 모르겠어요',
  unsureValue,
  playing,
  onListen,
}: {
  options: [{ value: T; label: ReactNode }, { value: T; label: ReactNode }];
  value: T | null;
  onChange: (v: T) => void;
  unsureLabel?: string;
  unsureValue?: T;
  /** 지금 소리가 나는 쪽(재생 표시) */
  playing?: T | null;
  /** 누르면 그 소리를 들려준다(선택과 동시에) */
  onListen?: (v: T) => void;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`btn btn-lg${value === o.value ? ' is-selected' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => {
              onListen?.(o.value);
              onChange(o.value);
            }}
            style={{ flexDirection: 'column', minHeight: 72 }}
          >
            <span className="row" style={{ gap: 6 }}>
              {value === o.value ? <Icon name="check" /> : playing === o.value ? <Icon name="speaker" /> : null}
              {o.label}
            </span>
            {playing === o.value && <span className="small" style={{ fontWeight: 500 }}>소리 나는 중</span>}
          </button>
        ))}
      </div>
      {unsureValue !== undefined && (
        <button
          type="button"
          className={`btn btn-block${value === unsureValue ? ' is-selected' : ''}`}
          aria-pressed={value === unsureValue}
          onClick={() => onChange(unsureValue)}
        >
          {value === unsureValue && <Icon name="check" />}
          {unsureLabel}
        </button>
      )}
    </div>
  );
}

/** 단계 진행 표시(①–⑥) */
export function Steps({ total, current, done, labels }: { total: number; current: number; done: number[]; labels?: string[] }) {
  return (
    <ol className="row" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }} aria-label="진행 단계">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const isCur = n === current;
        const isDone = done.includes(n);
        return (
          <li
            key={n}
            aria-current={isCur ? 'step' : undefined}
            style={{
              minWidth: 36,
              height: 36,
              borderRadius: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
              border: `2px solid ${isCur ? 'var(--primary)' : 'var(--hairline-strong)'}`,
              background: isCur ? 'var(--primary)' : isDone ? 'var(--surface-strong)' : 'transparent',
              color: isCur ? 'var(--on-primary)' : 'var(--body-strong)',
            }}
          >
            <span className="sr-only">{labels?.[n - 1] ?? `${n}단계`} {isDone ? '완료' : ''}</span>
            <span aria-hidden="true">{isDone && !isCur ? '✓' : n}</span>
          </li>
        );
      })}
    </ol>
  );
}
