// 악기 연주자 일러스트(Clay 톤 인라인 SVG). 그림 2–3장 + CSS 변형으로 움직인다(구성안 5.2).
// 포즈는 svg의 data-pose 속성으로 고르고, 변형 크기는 CSS 변수 --fi(0–1)로 정한다.
import { useId, type ReactNode } from 'react';
import type { InstrumentId } from '../../types';
import './instruments.css';

export type FigurePose = 'idle' | 'hitCenter' | 'hitEdge' | 'pluck' | 'blow' | 'rest';

const OUT = '#7a5238'; // 외곽선(따뜻한 갈색)
const SKIN = '#f4c9a3';
const SLEEVE = '#f7e6c9';
const PANTS = '#d9bc92';
const SHOE = '#8a5a3c';

const VALID: Record<InstrumentId, FigurePose[]> = {
  cajon: ['idle', 'hitCenter', 'hitEdge'],
  bass: ['idle', 'pluck'],
  trumpet: ['idle', 'blow', 'rest'],
};

function Defs({ p }: { p: string }) {
  const rg = (id: string, a: string, b: string, c: string) => (
    <radialGradient id={`${p}-${id}`} cx="0.32" cy="0.28" r="0.85">
      <stop offset="0" stopColor={a} />
      <stop offset="0.55" stopColor={b} />
      <stop offset="1" stopColor={c} />
    </radialGradient>
  );
  return (
    <defs>
      {rg('skin', '#fff0dc', SKIN, '#e0a984')}
      {rg('cloth', '#fffaf0', SLEEVE, '#e6cfa8')}
      {rg('wood', '#e8b27a', '#c98b4e', '#9a6234')}
      {rg('woodL', '#f0c999', '#d9a46c', '#b97f48')}
      {rg('woodD', '#b9824f', '#93602f', '#6e4522')}
      {rg('brass', '#fff1a8', '#e3b53c', '#b5811c')}
      {rg('ebony', '#6a5648', '#3c2e25', '#241912')}
      {rg('hair', '#8a6246', '#5a3b2a', '#3d2619')}
    </defs>
  );
}

/** 굵은 팔: 외곽선 + 소매색 + 하이라이트 */
function Limb({ d, w = 13, color = SLEEVE }: { d: string; w?: number; color?: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={OUT} strokeWidth={w + 5} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth={w * 0.25} strokeLinecap="round" transform="translate(-1.5 -2)" />
    </>
  );
}

function Hand({ p, x, y, r = 7.5 }: { p: string; x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={`url(#${p}-skin)`} stroke={OUT} strokeWidth="2.6" />;
}

function Head({ p, cx, cy, r = 20, mouth = true }: { p: string; cx: number; cy: number; r?: number; mouth?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${p}-skin)`} stroke={OUT} strokeWidth="3" />
      <path
        d={`M${cx - r + 1} ${cy - 3} A${r - 1} ${r - 1} 0 0 1 ${cx + r - 1} ${cy - 3} Q${cx} ${cy - r * 0.62} ${cx - r + 1} ${cy - 3} Z`}
        fill={`url(#${p}-hair)`}
        stroke={OUT}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx={cx - 7} cy={cy + 2} r="2.4" fill="#4a3224" />
      <circle cx={cx + 7} cy={cy + 2} r="2.4" fill="#4a3224" />
      <circle cx={cx - 12} cy={cy + 9} r="3.6" fill="#f19a86" opacity=".5" />
      <circle cx={cx + 12} cy={cy + 9} r="3.6" fill="#f19a86" opacity=".5" />
      {mouth && <path d={`M${cx - 4} ${cy + 10} Q${cx} ${cy + 14} ${cx + 4} ${cy + 10}`} fill="none" stroke="#4a3224" strokeWidth="2" strokeLinecap="round" />}
      <ellipse cx={cx - 7} cy={cy - 9} rx="5" ry="2.6" fill="#fff" opacity=".28" transform={`rotate(-25 ${cx - 7} ${cy - 9})`} />
    </g>
  );
}

function Torso({ p, x, y, w, h }: { p: string; x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.4} fill={`url(#${p}-cloth)`} stroke={OUT} strokeWidth="3" />
      <ellipse cx={x + w * 0.32} cy={y + h * 0.22} rx={w * 0.14} ry={h * 0.1} fill="#fff" opacity=".45" />
    </g>
  );
}

function Leg({ x, y, h, w = 15 }: { x: number; y: number; h: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w / 2} fill={PANTS} stroke={OUT} strokeWidth="3" />
      <ellipse cx={x + w / 2 + 2} cy={y + h} rx={w * 0.85} ry="6" fill={SHOE} stroke={OUT} strokeWidth="2.6" />
    </g>
  );
}

const Shadow = ({ cx = 100, rx = 70 }: { cx?: number; rx?: number }) => <ellipse cx={cx} cy="189" rx={rx} ry="7.5" fill="#3a2418" opacity=".2" />;

// 포즈에 따라 보이는 그룹. cls에 포즈 이름을 공백으로 나열한다
const P = ({ poses, children }: { poses: FigurePose[]; children: ReactNode }) => (
  <g className={'f-p ' + poses.map((x) => 'f-' + x).join(' ')}>{children}</g>
);

function Cajon({ p }: { p: string }) {
  return (
    <>
      <Shadow />
      <Leg x={34} y={116} h={60} />
      <Leg x={151} y={116} h={60} />
      <g className="f-bob">
        <Torso p={p} x={72} y={58} w={56} h={58} />
        <Head p={p} cx={100} cy={36} />
      </g>
      {/* 앉는 면 + 무릎 */}
      <rect x="40" y="100" width="120" height="16" rx="8" fill={`url(#${p}-woodD)`} stroke={OUT} strokeWidth="3" />
      <circle cx="42" cy="112" r="10" fill={PANTS} stroke={OUT} strokeWidth="3" />
      <circle cx="158" cy="112" r="10" fill={PANTS} stroke={OUT} strokeWidth="3" />
      {/* 앞면 */}
      <rect x="46" y="110" width="108" height="68" rx="13" fill={`url(#${p}-wood)`} stroke={OUT} strokeWidth="3.4" />
      <rect x="56" y="121" width="88" height="48" rx="8" fill={`url(#${p}-woodL)`} stroke={OUT} strokeOpacity=".55" strokeWidth="2" />
      <path d="M62 134 Q100 130 138 134 M62 146 Q100 143 138 146 M62 158 Q100 155 138 158" fill="none" stroke="#9a6234" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="70" cy="128" rx="9" ry="3" fill="#fff" opacity=".35" />
      {/* 왼팔(항상 무릎 위) */}
      <Limb d="M78 74 Q62 90 56 102" />
      <Hand p={p} x={56} y={103} />
      {/* 오른팔 */}
      <P poses={['idle']}>
        <Limb d="M122 74 Q140 90 146 102" />
        <Hand p={p} x={146} y={103} />
      </P>
      <P poses={['hitCenter']}>
        <Limb d="M122 74 Q146 108 110 136" />
        <Hand p={p} x={106} y={140} r={8.5} />
        <g className="f-impact" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <circle cx="106" cy="140" r="15" strokeOpacity=".8" />
          <path d="M82 128 L88 132 M130 128 L124 132 M106 112 L106 118" stroke={OUT} strokeWidth="2.4" />
        </g>
      </P>
      <P poses={['hitEdge']}>
        <Limb d="M122 74 Q150 98 120 112" />
        <Hand p={p} x={116} y={114} r={8.5} />
        <g className="f-impact" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <circle cx="116" cy="114" r="15" strokeOpacity=".8" />
          <path d="M134 100 L129 105 M142 112 L135 113 M98 106 L103 110" stroke={OUT} strokeWidth="2.4" />
        </g>
      </P>
    </>
  );
}

function Bass({ p }: { p: string }) {
  const body = 'M88 78 C62 78 56 98 70 108 C52 114 46 138 54 156 C62 178 114 178 122 156 C130 138 124 114 106 108 C120 98 114 78 88 78 Z';
  return (
    <>
      <Shadow cx={102} rx={78} />
      {/* 연주자(악기 뒤) */}
      <Leg x={126} y={138} h={42} w={14} />
      <Leg x={155} y={138} h={42} w={14} />
      <g className="f-bob">
        <Torso p={p} x={122} y={76} w={54} h={68} />
        <Head p={p} cx={149} cy={52} r={19} />
      </g>
      {/* 목·두루마리 */}
      <rect x="81" y="24" width="14" height="64" rx="6" fill={`url(#${p}-ebony)`} stroke={OUT} strokeWidth="3" />
      <circle cx="88" cy="16" r="11" fill={`url(#${p}-wood)`} stroke={OUT} strokeWidth="3" />
      <circle cx="88" cy="16" r="4.5" fill="none" stroke={OUT} strokeWidth="2.2" />
      {/* 몸통 */}
      <path d={body} fill={`url(#${p}-wood)`} stroke={OUT} strokeWidth="3.6" strokeLinejoin="round" />
      <path d={body} fill="none" stroke="#9a6234" strokeOpacity=".5" strokeWidth="1.8" transform="translate(88 128) scale(.86) translate(-88 -128)" />
      <ellipse cx="68" cy="146" rx="8" ry="14" fill="#fff" opacity=".28" transform="rotate(12 68 146)" />
      {/* f홀 */}
      <path d="M73 118 Q67 128 73 142" fill="none" stroke={`#2a1a10`} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M103 118 Q109 128 103 142" fill="none" stroke={`#2a1a10`} strokeWidth="3.6" strokeLinecap="round" />
      {/* 줄·브리지·줄걸이 */}
      <path d="M84 150 h8 l-1 22 h-6 z" fill={`url(#${p}-ebony)`} stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
      <g stroke="#efe6d2" strokeWidth="1.5" strokeLinecap="round" opacity=".95">
        <path d="M84.5 26 L83 152" />
        <path d="M87 26 L86.3 152" />
        <path d="M89.5 26 L89.7 152" />
        <path d="M92 26 L93 152" />
      </g>
      <rect x="74" y="133" width="28" height="6" rx="3" fill="#e9d4a8" stroke={OUT} strokeWidth="2.2" />
      {/* 엔드핀 */}
      <path d="M88 176 L88 190" stroke={OUT} strokeWidth="3.4" strokeLinecap="round" />
      {/* 줄 튕김(손가락 피치카토) */}
      <P poses={['pluck']}>
        <path d="M86.3 98 L101 141 L86.5 152" fill="none" stroke="#efe6d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <g className="f-vib" fill="none" stroke={OUT} strokeWidth="2.4" strokeLinecap="round">
          <path d="M74 104 Q69 128 76 154" />
          <path d="M104 104 Q112 128 106 154" />
          <path d="M66 112 Q61 130 67 150" strokeOpacity=".55" />
        </g>
      </P>
      {/* 왼팔: 지판 위 */}
      <Limb d="M130 90 Q112 66 99 62" />
      <Hand p={p} x={95} y={62} />
      {/* 오른팔: 줄 가까이 */}
      <P poses={['idle']}>
        <Limb d="M138 112 Q124 140 111 147" />
        <Hand p={p} x={108} y={148} />
      </P>
      <P poses={['pluck']}>
        <Limb d="M138 112 Q124 136 108 141" />
        <Hand p={p} x={104} y={141} />
      </P>
    </>
  );
}

function Trumpet({ p }: { p: string }) {
  return (
    <>
      <Shadow cx={92} rx={66} />
      <Leg x={74} y={138} h={42} w={15} />
      <Leg x={96} y={138} h={42} w={15} />
      <g className="f-bob">
        <Torso p={p} x={64} y={80} w={56} h={64} />
        <Head p={p} cx={92} cy={50} r={20} mouth={false} />
        <P poses={['idle', 'rest']}>
          <path d="M87 60 Q92 65 97 60" fill="none" stroke="#4a3224" strokeWidth="2" strokeLinecap="round" />
        </P>
        <P poses={['blow']}>
          <circle className="f-puff" cx="78" cy="61" r="7" fill="#f19a86" opacity=".7" stroke={OUT} strokeWidth="1.6" strokeOpacity=".5" />
          <circle className="f-puff" cx="106" cy="61" r="7" fill="#f19a86" opacity=".7" stroke={OUT} strokeWidth="1.6" strokeOpacity=".5" />
        </P>
      </g>
      {/* 트럼펫: 입에 닿는 위치가 (104,58) */}
      <g className="f-trumpet">
        <rect x="100" y="54" width="9" height="8" rx="3.5" fill={`url(#${p}-brass)`} stroke={OUT} strokeWidth="2.6" />
        <rect x="108" y="53" width="44" height="9" rx="4.5" fill={`url(#${p}-brass)`} stroke={OUT} strokeWidth="3" />
        <rect x="118" y="64" width="30" height="13" rx="6.5" fill="none" stroke={OUT} strokeWidth="6" />
        <rect x="118" y="64" width="30" height="13" rx="6.5" fill="none" stroke="#e3b53c" strokeWidth="3" />
        {[124, 133, 142].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="44" width="6" height="12" rx="3" fill="#f6efe0" stroke={OUT} strokeWidth="2.4" />
            <rect x={x - 4.5} y="53" width="9" height="12" rx="3" fill={`url(#${p}-brass)`} stroke={OUT} strokeWidth="2.4" />
          </g>
        ))}
        <path d="M150 53 Q164 52 171 36 Q179 58 171 80 Q164 63 150 62 Z" fill={`url(#${p}-brass)`} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="173" cy="58" rx="4" ry="18" fill="#8a5a1c" stroke={OUT} strokeWidth="2" />
        <ellipse cx="124" cy="55" rx="5" ry="2" fill="#fff" opacity=".6" />
        <P poses={['blow']}>
          <g className="f-breath" fill="none" stroke={OUT} strokeWidth="2.6" strokeLinecap="round">
            <path d="M181 46 Q186 58 181 70" />
            <path d="M188 40 Q195 58 188 76" strokeOpacity=".6" />
          </g>
        </P>
      </g>
      {/* 팔(트럼펫 아래를 받침) */}
      <P poses={['blow']}>
        <Limb d="M114 94 Q128 96 130 74" />
        <Hand p={p} x={130} y={72} />
      </P>
      <P poses={['idle']}>
        <Limb d="M114 94 Q126 104 128 106" />
        <Hand p={p} x={128} y={107} />
      </P>
      <P poses={['rest']}>
        <Limb d="M114 94 Q128 112 124 136" />
        <Hand p={p} x={124} y={138} />
      </P>
    </>
  );
}

export function InstrumentFigure({
  id,
  on,
  pose = 'idle',
  intensity = 1,
  size = 120,
}: {
  id: InstrumentId;
  on: boolean;
  pose?: FigurePose;
  intensity?: number;
  size?: number;
}) {
  const uid = 'f' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const shown: FigurePose = on && VALID[id].includes(pose) ? pose : 'idle';
  const fi = on ? Math.max(0, Math.min(1, intensity)) : 0;
  return (
    <svg
      className={'inst-fig' + (on ? '' : ' inst-fig-off')}
      data-inst={id}
      data-pose={shown}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ ['--fi' as string]: fi }}
      aria-hidden="true"
      focusable="false"
    >
      <Defs p={uid} />
      {id === 'cajon' && <Cajon p={uid} />}
      {id === 'bass' && <Bass p={uid} />}
      {id === 'trumpet' && <Trumpet p={uid} />}
    </svg>
  );
}
