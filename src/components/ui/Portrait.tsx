import type { SpeakerId } from "@/lib/levels/types";

export const SPEAKERS: Record<SpeakerId, { name: string; role: string }> = {
  kublet: { name: "Kublet", role: "your pager-bot" },
  mayor: { name: "Mayor Beatrix", role: "Mayor of Kubetopia" },
  crier: { name: "Finnian", role: "town crier" },
  intern: { name: "Devin", role: "the intern" },
  mentor: { name: "Old Sal", role: "SRE, retired" },
  power: { name: "Vola", role: "power company" },
  committee: { name: "Lady Prunella", role: "festival committee" },
  marketing: { name: "Chad", role: "marketing" },
  analytics: { name: "Ada", role: "analytics team" },
  weather: { name: "Gale", role: "storm watch" },
  doctor: { name: "Dr. Iris", role: "town hospital" },
  architect: { name: "Elowen", role: "town architect" },
  queen: { name: "The Cloud Queen", role: "royal inspector" },
};

/* Shared face bits ---------------------------------------------------- */

function Eyes({ y = 52, gap = 11, worried = false }: { y?: number; gap?: number; worried?: boolean }) {
  return (
    <g>
      <circle cx={50 - gap} cy={y} r={4.6} fill="#fff" />
      <circle cx={50 + gap} cy={y} r={4.6} fill="#fff" />
      <circle cx={50 - gap} cy={y + 0.8} r={2.1} fill="#2b2320" />
      <circle cx={50 + gap} cy={y + 0.8} r={2.1} fill="#2b2320" />
      {worried ? (
        <>
          <path d={`M ${41 - gap} ${y - 9} q 6 -3 10 1`} stroke="#3b2f24" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d={`M ${59 + gap - 10} ${y - 8} q 5 -4 10 2`} stroke="#3b2f24" strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={`M ${43 - gap} ${y - 8} h 9`} stroke="#3b2f24" strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${48 + gap} ${y - 8} h 9`} stroke="#3b2f24" strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function Smile({ y = 66, w = 9, open = false }: { y?: number; w?: number; open?: boolean }) {
  return open ? (
    <ellipse cx={50} cy={y} rx={w * 0.7} ry={w * 0.55} fill="#7a3b30" />
  ) : (
    <path d={`M ${50 - w} ${y} q ${w} ${w * 0.9} ${w * 2} 0`} stroke="#7a3b30" strokeWidth={2.6} fill="none" strokeLinecap="round" />
  );
}

function Head({ skin, wide = false }: { skin: string; wide?: boolean }) {
  return <ellipse cx={50} cy={56} rx={wide ? 24 : 21} ry={24} fill={skin} />;
}

function Cheeks() {
  return (
    <g fill="#f2a3a3" opacity={0.75}>
      <circle cx={33} cy={62} r={4} />
      <circle cx={67} cy={62} r={4} />
    </g>
  );
}

/* The cast ------------------------------------------------------------ */

function MayorFace() {
  return (
    <g>
      {/* sash */}
      <path d="M 22 96 L 62 78 L 70 92 L 30 100 Z" fill="#c0392b" />
      <Head skin="#e8b48c" />
      {/* grey bun */}
      <circle cx={50} cy={30} r={10} fill="#cdc6bd" />
      <path d="M 28 46 a 24 22 0 0 1 44 0 l -4 4 a 20 18 0 0 0 -36 0 Z" fill="#cdc6bd" />
      <Eyes />
      {/* round glasses */}
      <g stroke="#8a6f4a" strokeWidth={1.8} fill="none">
        <circle cx={39} cy={53} r={7.5} />
        <circle cx={61} cy={53} r={7.5} />
        <path d="M 46.5 53 h 7" />
      </g>
      <Cheeks />
      <Smile />
      {/* chain of office */}
      <path d="M 34 84 q 16 12 32 0" stroke="#d9b44a" strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={50} cy={92} r={4} fill="#d9b44a" />
    </g>
  );
}

function KubletFace() {
  return (
    <g>
      {/* antenna */}
      <line x1={50} y1={22} x2={50} y2={32} stroke="#7b8794" strokeWidth={3} />
      <circle cx={50} cy={19} r={4} fill="#38bdf8" />
      {/* head */}
      <rect x={27} y={32} width={46} height={42} rx={10} fill="#cfe3f7" stroke="#7b8794" strokeWidth={2} />
      {/* screen eyes */}
      <rect x={35} y={44} width={10} height={10} rx={2.5} fill="#0ea5e9" />
      <rect x={55} y={44} width={10} height={10} rx={2.5} fill="#0ea5e9" />
      {/* smile display */}
      <path d="M 40 63 q 10 7 20 0" stroke="#0ea5e9" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* body plate + wheel emblem */}
      <rect x={34} y={76} width={32} height={18} rx={6} fill="#a9c3dd" />
      <circle cx={50} cy={85} r={6} fill="none" stroke="#326ce5" strokeWidth={2} />
      <circle cx={50} cy={85} r={1.6} fill="#326ce5" />
    </g>
  );
}

function CrierFace() {
  return (
    <g>
      <path d="M 24 92 L 50 80 L 76 92 L 76 100 L 24 100 Z" fill="#8a2f2f" />
      <Head skin="#c68642" />
      {/* tricorn hat */}
      <path d="M 24 42 Q 50 18 76 42 L 68 46 Q 50 32 32 46 Z" fill="#3f2c18" />
      <Eyes />
      <Cheeks />
      {/* shouting mouth */}
      <Smile open />
      {/* hand bell */}
      <g transform="translate(74 70) rotate(20)">
        <path d="M 0 0 q 6 0 6 9 h -12 q 0 -9 6 -9" fill="#d9b44a" />
        <circle cx={0} cy={10.5} r={1.8} fill="#8a6f4a" />
      </g>
    </g>
  );
}

function InternFace() {
  return (
    <g>
      <Head skin="#ffdbac" />
      {/* backwards cap */}
      <path d="M 28 45 a 23 20 0 0 1 44 0 Z" fill="#2f8f83" />
      <rect x={62} y={38} width={14} height={7} rx={3} fill="#25726a" />
      <Eyes worried />
      {/* freckles */}
      <g fill="#d9a066">
        <circle cx={36} cy={63} r={1.2} />
        <circle cx={41} cy={65} r={1.2} />
        <circle cx={59} cy={65} r={1.2} />
        <circle cx={64} cy={63} r={1.2} />
      </g>
      {/* nervous wavy mouth */}
      <path d="M 42 68 q 4 -3 8 0 t 8 0" stroke="#7a3b30" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {/* lanyard */}
      <path d="M 38 88 l 6 12 M 62 88 l -6 12" stroke="#2f8f83" strokeWidth={3} />
      <rect x={44} y={96} width={12} height={8} rx={2} fill="#fff" stroke="#94a3b8" />
    </g>
  );
}

function MentorFace() {
  return (
    <g>
      <Head skin="#d9a066" />
      {/* flat cap */}
      <path d="M 27 44 a 23 16 0 0 1 46 0 Z" fill="#6b7280" />
      <path d="M 25 44 h 50 l -4 5 h -42 Z" fill="#565d68" />
      {/* big grey beard */}
      <path d="M 29 60 q 0 26 21 26 q 21 0 21 -26 q -8 8 -21 8 q -13 0 -21 -8" fill="#cdc6bd" />
      <Eyes y={54} />
      {/* bushy brows */}
      <path d="M 32 45 q 7 -4 13 0" stroke="#a9a29a" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <path d="M 55 45 q 7 -4 13 0" stroke="#a9a29a" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <Smile y={70} w={6} />
    </g>
  );
}

function PowerFace() {
  return (
    <g>
      <path d="M 26 94 L 50 84 L 74 94 L 74 100 L 26 100 Z" fill="#e8930c" />
      <Head skin="#8d5524" />
      {/* hard hat */}
      <path d="M 27 46 a 23 19 0 0 1 46 0 Z" fill="#f5c518" />
      <rect x={24} y={44} width={52} height={6} rx={3} fill="#dca90a" />
      <rect x={46} y={28} width={8} height={12} rx={3} fill="#f5c518" />
      <Eyes />
      <Cheeks />
      <Smile />
      {/* bolt badge */}
      <path d="M 50 88 l -4 8 h 4 l -2 7 l 8 -10 h -4 l 3 -5 Z" fill="#f5c518" />
    </g>
  );
}

function CommitteeFace() {
  return (
    <g>
      <Head skin="#f2c9a0" />
      {/* grand hat with feather */}
      <ellipse cx={50} cy={40} rx={27} ry={8} fill="#7a3f8a" />
      <path d="M 34 40 a 16 14 0 0 1 32 0 Z" fill="#8f54a0" />
      <path d="M 66 34 q 12 -14 6 -24 q -2 12 -12 20 Z" fill="#e879a9" />
      <Eyes />
      {/* lashes */}
      <path d="M 33 48 l -4 -2 M 67 48 l 4 -2" stroke="#2b2320" strokeWidth={1.6} strokeLinecap="round" />
      <Cheeks />
      {/* lipstick smile */}
      <path d="M 42 66 q 8 8 16 0" stroke="#c0392b" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      {/* pearls */}
      <g fill="#f3ecdb">
        <circle cx={40} cy={88} r={3} /><circle cx={47} cy={91} r={3} /><circle cx={54} cy={91} r={3} /><circle cx={61} cy={88} r={3} />
      </g>
    </g>
  );
}

function MarketingFace() {
  return (
    <g>
      <path d="M 26 96 L 50 82 L 74 96 L 74 100 L 26 100 Z" fill="#3f5d8a" />
      <path d="M 47 84 h 6 l -3 12 Z" fill="#c0392b" />
      <Head skin="#e0ac69" />
      {/* slick hair */}
      <path d="M 28 46 a 23 20 0 0 1 44 0 q -4 -8 -12 -9 q 4 5 -2 6 q -14 -8 -30 3" fill="#2b2320" />
      {/* sunglasses */}
      <g fill="#26242a">
        <rect x={31} y={48} width={16} height={10} rx={4} />
        <rect x={53} y={48} width={16} height={10} rx={4} />
        <rect x={45} y={51} width={10} height={3} />
      </g>
      {/* huge grin */}
      <path d="M 38 66 q 12 12 24 0" stroke="#7a3b30" strokeWidth={2.6} fill="#fff" strokeLinecap="round" />
    </g>
  );
}

function AnalyticsFace() {
  return (
    <g>
      <Head skin="#ffe0bd" />
      {/* messy curls */}
      <g fill="#5d4024">
        <circle cx={33} cy={38} r={8} /><circle cx={44} cy={33} r={8} /><circle cx={56} cy={33} r={8} /><circle cx={67} cy={38} r={8} />
        <circle cx={28} cy={48} r={6} /><circle cx={72} cy={48} r={6} />
      </g>
      <Eyes />
      {/* big round glasses */}
      <g stroke="#326ce5" strokeWidth={2.2} fill="none">
        <circle cx={39} cy={53} r={9} />
        <circle cx={61} cy={53} r={9} />
        <path d="M 48 53 h 4" />
      </g>
      <Smile w={6} />
      {/* tiny bar chart pin */}
      <g fill="#326ce5">
        <rect x={40} y={92} width={4} height={8} /><rect x={46} y={88} width={4} height={12} /><rect x={52} y={84} width={4} height={16} />
      </g>
    </g>
  );
}

function WeatherFace() {
  return (
    <g>
      <Head skin="#e8b48c" />
      {/* windswept hair */}
      <path d="M 28 46 a 23 20 0 0 1 44 0 l 8 -4 q -6 -2 -6 -6 l 6 -2 q -10 -4 -14 -2 q -20 -10 -38 14" fill="#8a5a2b" />
      <Eyes worried />
      {/* headset */}
      <path d="M 27 50 a 24 22 0 0 1 46 0" stroke="#26242a" strokeWidth={3.4} fill="none" />
      <rect x={22} y={48} width={7} height={12} rx={3} fill="#26242a" />
      <path d="M 27 60 q 6 12 16 10" stroke="#26242a" strokeWidth={2.6} fill="none" />
      <circle cx={44} cy={70} r={2.6} fill="#26242a" />
      {/* focused mouth */}
      <path d="M 44 67 h 12" stroke="#7a3b30" strokeWidth={2.6} strokeLinecap="round" />
      {/* storm pin */}
      <path d="M 66 88 a 6 6 0 1 1 4 -10 a 5 5 0 1 1 2 10 Z" fill="#94a3b8" />
      <path d="M 68 88 l -3 7 h 3 l -2 6 l 6 -8 h -3 l 2 -5 Z" fill="#f5c518" />
    </g>
  );
}

function DoctorFace() {
  return (
    <g>
      <path d="M 26 96 L 50 84 L 74 96 L 74 100 L 26 100 Z" fill="#f3f6f9" />
      <Head skin="#c68642" />
      {/* surgical cap with cross */}
      <path d="M 27 45 a 23 20 0 0 1 46 0 Z" fill="#f3f6f9" />
      <rect x={46} y={32} width={8} height={3} fill="#c0392b" />
      <rect x={48.5} y={29.5} width={3} height={8} fill="#c0392b" />
      <Eyes />
      <Cheeks />
      <Smile />
      {/* stethoscope */}
      <path d="M 38 88 q 0 10 12 10 q 12 0 12 -10" stroke="#326ce5" strokeWidth={2.6} fill="none" />
      <circle cx={62} cy={90} r={3.4} fill="#326ce5" />
    </g>
  );
}

function ArchitectFace() {
  return (
    <g>
      <Head skin="#e0ac69" />
      {/* neat bob with straight fringe */}
      <path d="M 27 58 q -2 -30 23 -30 q 25 0 23 30 l -6 0 q 2 -14 -4 -20 l -2 6 q -12 -6 -22 0 l -2 -6 q -6 6 -4 20 Z" fill="#4a3220" />
      <Eyes />
      {/* pencil tucked over the ear */}
      <g transform="translate(70 48) rotate(64)">
        <rect x={0} y={0} width={4} height={16} rx={1} fill="#e8930c" />
        <path d="M 0 0 l 2 -4 l 2 4 Z" fill="#d9a066" />
      </g>
      <Cheeks />
      <Smile w={7} />
      {/* rolled blueprint */}
      <g transform="translate(30 86) rotate(-18)">
        <rect x={0} y={0} width={40} height={9} rx={4.5} fill="#7fb2e5" />
        <rect x={0} y={0} width={40} height={9} rx={4.5} fill="none" stroke="#4e7ab5" strokeWidth={1.5} />
        <circle cx={40} cy={4.5} r={4.5} fill="#dbeafe" />
      </g>
    </g>
  );
}

function QueenFace() {
  return (
    <g>
      {/* royal collar */}
      <path d="M 22 100 L 50 78 L 78 100 Z" fill="#5b3a8f" />
      <path d="M 44 86 l 6 6 l 6 -6 l -6 14 Z" fill="#d9b44a" />
      <Head skin="#f2c9a0" />
      {/* silver waves */}
      <path d="M 27 56 q -3 -26 23 -26 q 26 0 23 26 l -5 1 q 1 -12 -5 -17 q -13 -7 -26 0 q -6 5 -5 17 Z" fill="#dfe3ea" />
      {/* cloud crown */}
      <g>
        <circle cx={36} cy={26} r={7} fill="#fff" stroke="#d9b44a" strokeWidth={2} />
        <circle cx={50} cy={21} r={8.5} fill="#fff" stroke="#d9b44a" strokeWidth={2} />
        <circle cx={64} cy={26} r={7} fill="#fff" stroke="#d9b44a" strokeWidth={2} />
        <circle cx={50} cy={21} r={2.4} fill="#38bdf8" />
      </g>
      <Eyes />
      {/* regal lashes */}
      <path d="M 32 47 l -4 -2 M 68 47 l 4 -2" stroke="#2b2320" strokeWidth={1.6} strokeLinecap="round" />
      {/* composed, appraising mouth */}
      <path d="M 44 66 q 6 3.5 12 0" stroke="#a3455c" strokeWidth={2.8} fill="none" strokeLinecap="round" />
      {/* pearl drops */}
      <circle cx={27} cy={64} r={2.6} fill="#f3ecdb" />
      <circle cx={73} cy={64} r={2.6} fill="#f3ecdb" />
    </g>
  );
}

const FACES: Record<SpeakerId, () => React.ReactNode> = {
  kublet: KubletFace,
  mayor: MayorFace,
  crier: CrierFace,
  intern: InternFace,
  mentor: MentorFace,
  power: PowerFace,
  committee: CommitteeFace,
  marketing: MarketingFace,
  analytics: AnalyticsFace,
  weather: WeatherFace,
  doctor: DoctorFace,
  architect: ArchitectFace,
  queen: QueenFace,
};

const BACKDROPS: Record<SpeakerId, string> = {
  kublet: "#dbeafe",
  mayor: "#fde8d7",
  crier: "#fdeed7",
  intern: "#d7f2ee",
  mentor: "#ece8df",
  power: "#fdf3d0",
  committee: "#f3e3f7",
  marketing: "#dde7f5",
  analytics: "#e3ecfb",
  weather: "#e3e9f0",
  doctor: "#e5f3ec",
  architect: "#e8effa",
  queen: "#f1e9fb",
};

export default function Portrait({ id, size = 76 }: { id: SpeakerId; size?: number }) {
  const FaceSvg = FACES[id];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${SPEAKERS[id].name}, ${SPEAKERS[id].role}`}
      className="portrait"
    >
      <circle cx={50} cy={50} r={49} fill={BACKDROPS[id]} stroke="#1e293b" strokeWidth={2.5} />
      <clipPath id={`portrait-clip-${id}`}>
        <circle cx={50} cy={50} r={47} />
      </clipPath>
      <g clipPath={`url(#portrait-clip-${id})`}>{FaceSvg()}</g>
    </svg>
  );
}
