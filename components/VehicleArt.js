export default function VehicleArt({ kind }) {
  return (
    <svg className="fleet-art" viewBox="0 0 220 112" aria-hidden="true">
      <ellipse cx="110" cy="98" rx="72" ry="6" fill="#d5deea" />
      {shapes[kind] || shapes.fleet}
    </svg>
  );
}

const wheel = (cx) => (
  <g key={cx}>
    <circle cx={cx} cy="86" r="11" fill="#0e2744" />
    <circle cx={cx} cy="86" r="4.5" fill="#e8eef6" />
  </g>
);

const shapes = {
  pickup: (
    <g>
      <path d="M28 78 V58 H92 L108 42 H150 V78 Z" fill="#16345a" />
      <path d="M96 56 H146 V44 H110 Z" fill="#dbe7f5" />
      <path d="M28 66 H90 V58 H28 Z" fill="#2f6fed" />
      {wheel(58)}
      {wheel(128)}
    </g>
  ),
  truck: (
    <g>
      <path d="M18 80 V50 H78 V80 Z" fill="#16345a" />
      <path d="M78 80 V58 H118 L132 42 H158 V80 Z" fill="#16345a" />
      <path d="M122 56 H154 V44 H134 Z" fill="#dbe7f5" />
      <path d="M24 62 H72 V54 H24 Z" fill="#2f6fed" />
      {wheel(40)}
      {wheel(68)}
      {wheel(138)}
    </g>
  ),
  tanker: (
    <g>
      <path d="M118 80 V56 H150 L164 42 H186 V80 Z" fill="#16345a" />
      <path d="M154 54 H182 V44 H166 Z" fill="#dbe7f5" />
      <rect x="22" y="52" width="96" height="28" rx="14" fill="#16345a" />
      <path d="M30 66 H110" stroke="#2f6fed" strokeWidth="3" />
      {wheel(48)}
      {wheel(92)}
      {wheel(158)}
    </g>
  ),
  trailer: (
    <g>
      <path d="M24 70 H150 V52 H36 Z" fill="#16345a" />
      <path d="M150 80 V62 H176 L188 48 H198 V80 Z" fill="#16345a" />
      <path d="M178 60 H194 V50 H184 Z" fill="#dbe7f5" />
      <path d="M32 62 H142" stroke="#2f6fed" strokeWidth="3" />
      {wheel(52)}
      {wheel(92)}
      {wheel(168)}
    </g>
  ),
  bus: (
    <g>
      <path d="M28 82 V48 H188 V82 Z" fill="#16345a" />
      <path d="M36 62 H176 V52 H36 Z" fill="#dbe7f5" />
      <path d="M28 70 H188" stroke="#2f6fed" strokeWidth="4" />
      {wheel(58)}
      {wheel(158)}
    </g>
  ),
  bobcat: (
    <g>
      <path d="M48 82 V58 H110 L128 46 H150 V82 Z" fill="#16345a" />
      <path d="M112 58 H146 V48 H130 Z" fill="#dbe7f5" />
      <path d="M36 70 H70 L58 50 H40 Z" fill="#2f6fed" />
      {wheel(64)}
      {wheel(124)}
    </g>
  ),
  jcb: (
    <g>
      <path d="M70 82 V56 H130 V82 Z" fill="#16345a" />
      <path d="M96 56 H126 V46 H104 Z" fill="#dbe7f5" />
      <path d="M40 64 H74" stroke="#2f6fed" strokeWidth="6" />
      <path d="M28 78 V52 H42 V78 Z" fill="#2f6fed" />
      <path d="M130 62 H176 L188 48" stroke="#16345a" strokeWidth="6" fill="none" />
      {wheel(88)}
      {wheel(118)}
    </g>
  ),
  excavator: (
    <g>
      <path d="M46 84 H132 V70 H46 Z" fill="#0e2744" />
      <path d="M58 70 V52 H118 V70 Z" fill="#16345a" />
      <path d="M78 52 H114 V44 H86 Z" fill="#dbe7f5" />
      <path d="M118 58 H168 L184 40" stroke="#2f6fed" strokeWidth="6" fill="none" />
      <path d="M176 48 H196 V36 H176 Z" fill="#16345a" />
      {wheel(62)}
      {wheel(90)}
      {wheel(116)}
    </g>
  ),
  fleet: (
    <g>
      <path d="M34 80 V54 H100 L116 40 H176 V80 Z" fill="#16345a" />
      <path d="M104 54 H170 V42 H118 Z" fill="#dbe7f5" />
      <path d="M40 66 H96 V58 H40 Z" fill="#2f6fed" />
      {wheel(62)}
      {wheel(148)}
    </g>
  ),
  record: (
    <g>
      <rect x="70" y="28" width="80" height="58" rx="8" fill="#16345a" />
      <path d="M84 48 H136 M84 60 H124" stroke="#dbe7f5" strokeWidth="4" />
      <path d="M84 70 H110" stroke="#2f6fed" strokeWidth="4" />
    </g>
  ),
};
