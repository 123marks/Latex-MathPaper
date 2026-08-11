// Paper OS brand mark — a rounded-square amber badge with a serif "P" knocked
// out of it. Hand-authored SVG so it stays crisp from nav (26px) to hero
// (96px) and matches the generated app icon / favicon. `bare` renders just the
// glyph tile without extra margin; default includes the badge.
export default function Logo({ size = 30, radius, className = "", style, title = "Paper OS" }) {
  const uid = `logo-${size}`;
  const r = radius ?? Math.round(size * 0.28);
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0d38a" />
          <stop offset="0.45" stopColor="#e2b564" />
          <stop offset="1" stopColor="#b8801f" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx={r * 48 / size} fill={`url(#${uid}-g)`} />
      {/* Serif "P" cut out to the badge's dark base color. */}
      <path
        d="M17 12.5h9.4c4.7 0 7.8 2.9 7.8 7.4 0 4.6-3.2 7.5-8.1 7.5h-4.5v8.1h3.3v1.5H17v-1.5h2.8V14h-2.8v-1.5Zm4.6 1.5v12.4h4c3.4 0 5.4-2.2 5.4-6.2 0-3.9-2-6.2-5.3-6.2h-4.1Z"
        fill="#12100b"
      />
    </svg>
  );
}
