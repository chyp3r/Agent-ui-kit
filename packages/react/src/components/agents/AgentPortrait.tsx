import { useId, type CSSProperties, type ReactNode } from "react";


/**
 * The team, drawn.
 *
 * One figure and nine trades: the same satin shell and visor everywhere, so they
 * read as one team, and a colour, a piece of headgear and a tool in hand so that
 * each can be told apart at 40px. Hand-drawn vector rather than image sheets:
 * nothing to download on an air-gapped site, sharp at every size, and the parts
 * are separate, so what moves is the thing the agent is actually doing — the
 * needle, the clock hands, the database disks.
 *
 * It moves only while `active`, and `active` only comes from the stream: a pose is
 * a statement about the run, so no timer ever sets it. The motion itself lives in
 * `styles.css` under `.agent-portrait`, where reduced motion can switch it off.
 */

interface Trade {
  accent: string;
  accentDeep: string;
  eye: string;
  /** Drawn over the head. */
  gear?: (ids: Ids) => ReactNode;
  /** Drawn in front of the shoulders, bottom right. */
  prop?: (ids: Ids) => ReactNode;
}

interface Ids {
  accent: string;
  glow: string;
  suit: string;
  shell: string;
  visor: string;
}

const NAVY = "#14243a";
const STEEL = "#1d3350";

function Antenna({ colour }: { colour: string }) {
  return (
    <g>
      <path d="M60 15V6" stroke="#b9b2a4" strokeWidth="3" strokeLinecap="round" />
      <circle className="ap-beacon" cx="60" cy="5" r="4" fill={colour} />
    </g>
  );
}

const TRADES: Record<string, Trade> = {
  planner: {
    accent: "#f2a93b",
    accentDeep: "#c57a14",
    eye: "#ffd591",
    gear: () => <Antenna colour="#f2a93b" />,
    prop: (ids) => (
      <g>
        <circle cx="90" cy="92" r="19" fill={NAVY} />
        <circle cx="90" cy="92" r="19" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="3.5" />
        <circle cx="90" cy="92" r="12.5" fill="none" stroke="#f2a93b" strokeOpacity=".28" strokeWidth="1.5" />
        <path d="M90 76.5v4M90 103.5v4M74.5 92h4M101.5 92h4" stroke="#f2a93b" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
        <g className="ap-needle">
          <path d="M90 78 95 92H85Z" fill="#ff7a59" />
          <path d="M90 106 85 92H95Z" fill="#f4efe6" />
        </g>
        <circle cx="90" cy="92" r="2.4" fill={NAVY} />
      </g>
    ),
  },
  searcher: {
    accent: "#35c3f3",
    accentDeep: "#1486b3",
    eye: "#a5ecff",
    gear: (ids) => (
      <g>
        <path d="M31 37C32 18 45 9 60 9s28 9 29 28C75 31 45 31 31 37Z" fill={`url(#${ids.suit})`} />
        <path d="M27 39.5C44 30 76 30 93 39.5c1.4 1 .6 3.3-1.2 2.7C75 36.5 45 36.5 28.2 42.2c-1.8.6-2.6-1.7-1.2-2.7Z" fill={`url(#${ids.accent})`} />
        <circle cx="60" cy="22" r="4.5" fill={`url(#${ids.accent})`} />
      </g>
    ),
    prop: (ids) => (
      <g className="ap-glass">
        <path d="M100.5 106 111 117" stroke="#c9c2b4" strokeWidth="7" strokeLinecap="round" />
        <circle cx="90" cy="90" r="18" fill="#35c3f3" fillOpacity=".2" />
        <circle cx="90" cy="90" r="18" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="5" />
        <path d="M80 84c2.5-4 6-5.5 10-5.5" stroke="#eafaff" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    ),
  },
  analyst: {
    accent: "#2fd3b5",
    accentDeep: "#129a80",
    eye: "#b0fff0",
    gear: (ids) => (
      <g fill="none" stroke={`url(#${ids.accent})`} strokeWidth="3">
        <circle cx="49" cy="45" r="10.5" />
        <circle cx="71" cy="45" r="10.5" />
        <path d="M59.5 45h1" />
      </g>
    ),
    prop: (ids) => (
      <g>
        <g className="ap-disk ap-disk-3">
          <path d="M72 98v12c0 4 8 7 18 7s18-3 18-7V98Z" fill={`url(#${ids.accent})`} />
          <ellipse cx="90" cy="98" rx="18" ry="6.5" fill="#7ceedb" />
        </g>
        <g className="ap-disk ap-disk-2">
          <path d="M72 86v12c0 4 8 7 18 7s18-3 18-7V86Z" fill={`url(#${ids.accent})`} />
          <ellipse cx="90" cy="86" rx="18" ry="6.5" fill="#7ceedb" />
        </g>
        <g className="ap-disk ap-disk-1">
          <path d="M72 74v12c0 4 8 7 18 7s18-3 18-7V74Z" fill={`url(#${ids.accent})`} />
          <ellipse cx="90" cy="74" rx="18" ry="6.5" fill="#b6f8ec" />
        </g>
      </g>
    ),
  },
  timekeeper: {
    accent: "#a48bfa",
    accentDeep: "#7255d9",
    eye: "#dcd2ff",
    gear: (ids) => (
      <g>
        <path d="M31.5 33C39 22 49 17.5 60 17.5S81 22 88.5 33l1.5 5C80 28 70 25 60 25s-20 3-30 13Z" fill={`url(#${ids.accent})`} />
        <circle cx="60" cy="21" r="3.5" fill="#f4efe6" />
      </g>
    ),
    prop: (ids) => (
      <g>
        <circle cx="90" cy="92" r="20" fill="#f4efe6" />
        <circle cx="90" cy="92" r="20" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="4.5" />
        <path d="M90 76v3M90 105v3M74 92h3M103 92h3" stroke={NAVY} strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        <path className="ap-hand-long" d="M90 92V79" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        <path className="ap-hand-short" d="M90 92h9" stroke="#7255d9" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="90" cy="92" r="2.5" fill={NAVY} />
      </g>
    ),
  },
  cataloger: {
    accent: "#8dd65a",
    accentDeep: "#5aa32d",
    eye: "#d6ffb4",
    gear: () => (
      <g>
        <path d="M31 39C31 20 44 10 60 10s29 10 29 29Z" fill="#f5b83d" />
        <path d="M53 11h14v13H53Z" fill="#fbd476" />
        <rect x="25" y="36.5" width="70" height="7" rx="3.5" fill="#d9951c" />
        <path d="M36 24c3-5 7-8 11-9.5" stroke="#fde6a8" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    ),
    prop: (ids) => (
      <g>
        <circle cx="90" cy="92" r="20" fill={NAVY} />
        <circle cx="90" cy="92" r="20" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="3.5" />
        <circle cx="90" cy="92" r="12" fill="none" stroke="#8dd65a" strokeOpacity=".45" strokeWidth="1.5" />
        <circle cx="90" cy="92" r="5" fill="none" stroke="#8dd65a" strokeOpacity=".45" strokeWidth="1.5" />
        <g className="ap-sweep">
          <path d="M90 92V72.5A19.5 19.5 0 0 1 106.9 82.3Z" fill="#8dd65a" fillOpacity=".5" />
          <path d="M90 92V72.5" stroke="#c7f59f" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle className="ap-ping" cx="99" cy="85" r="2.5" fill="#d6ffb4" />
      </g>
    ),
  },
  reviewer: {
    accent: "#3ddc97",
    accentDeep: "#17a56b",
    eye: "#c2ffe4",
    gear: (ids) => (
      <g>
        <path d="M33 33C36 17 47 10 60 10s24 7 27 23C74 27 46 27 33 33Z" fill={`url(#${ids.suit})`} />
        <path d="M28 36.5C45 28 75 28 92 36.5c1.5.8 1 3.3-.8 3C75 34 45 34 28.8 39.5c-1.8.3-2.3-2.2-.8-3Z" fill={NAVY} />
        <path d="M60 15l6.5 2.5v5c0 4-3 6.5-6.5 8-3.5-1.5-6.5-4-6.5-8v-5Z" fill="#f5c451" />
      </g>
    ),
    prop: (ids) => (
      <g>
        <path d="M90 69l20 7.5v14.5c0 13-9 21.5-20 26.5-11-5-20-13.5-20-26.5V76.5Z" fill={`url(#${ids.accent})`} />
        <path d="M90 74.5l15 5.6v11c0 10-7 16.5-15 20.4-8-3.9-15-10.4-15-20.4v-11Z" fill={NAVY} fillOpacity=".22" />
        <path className="ap-check" d="M80 92l7.5 7.5L101 85" fill="none" stroke="#f4fff9" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </g>
    ),
  },
  charter: {
    accent: "#ff7d9c",
    accentDeep: "#de4a72",
    eye: "#ffd6e0",
    gear: (ids) => (
      <g>
        <path d="M30 28C30 17 46 9.5 64 10c15 .4 26 6 26 13.5 0 5-8 3-14 2.5-13-1-30-1-38 3-4 2-8 3.5-8-1Z" fill={`url(#${ids.accent})`} />
        <circle cx="66" cy="8" r="3.5" fill={`url(#${ids.accent})`} />
      </g>
    ),
    prop: (ids) => (
      <g>
        <rect x="68" y="72" width="44" height="44" rx="9" fill={NAVY} />
        <rect x="68" y="72" width="44" height="44" rx="9" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="2.5" />
        <rect className="ap-bar ap-bar-1" x="75" y="94" width="8" height="16" rx="2" fill="#ffc48a" />
        <rect className="ap-bar ap-bar-2" x="86" y="84" width="8" height="26" rx="2" fill="#ff7d9c" />
        <rect className="ap-bar ap-bar-3" x="97" y="78" width="8" height="32" rx="2" fill="#a48bfa" />
      </g>
    ),
  },
  operator: {
    accent: "#ff8a5b",
    accentDeep: "#df5a2a",
    eye: "#ffd9c7",
    gear: (ids) => (
      <g fill="none">
        <path d="M27 46C25 14 95 14 93 46" stroke={NAVY} strokeWidth="5.5" strokeLinecap="round" />
        <rect x="21" y="38" width="11" height="19" rx="5.5" fill={`url(#${ids.accent})`} />
        <rect x="88" y="38" width="11" height="19" rx="5.5" fill={`url(#${ids.accent})`} />
        <path d="M94 56c0 9-9 13-20 13" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="72" cy="69" r="3.8" fill={`url(#${ids.accent})`} />
      </g>
    ),
    prop: (ids) => (
      <g fill="none" strokeLinecap="round">
        <circle cx="84" cy="96" r="9" fill={`url(#${ids.accent})`} />
        <path d="M81 96h6M84 93v6" stroke="#fff" strokeWidth="2.6" />
        <path className="ap-wave ap-wave-1" d="M96 85c5 5 5 17 0 22" stroke="#ff8a5b" strokeWidth="3.5" />
        <path className="ap-wave ap-wave-2" d="M104 78c9 9 9 27 0 36" stroke="#ff8a5b" strokeWidth="3.5" strokeOpacity=".7" />
      </g>
    ),
  },
  helper: {
    accent: "#6ba8ff",
    accentDeep: "#3676dd",
    eye: "#d5e6ff",
    gear: () => <Antenna colour="#6ba8ff" />,
    prop: (ids) => (
      <g>
        <path d="M74 72h32c5 0 9 4 9 9v16c0 5-4 9-9 9H90l-11 10v-10h-5c-5 0-9-4-9-9V81c0-5 4-9 9-9Z" fill={`url(#${ids.accent})`} />
        <circle className="ap-dot ap-dot-1" cx="78" cy="89" r="4" fill="#fff" />
        <circle className="ap-dot ap-dot-2" cx="90" cy="89" r="4" fill="#fff" />
        <circle className="ap-dot ap-dot-3" cx="102" cy="89" r="4" fill="#fff" />
      </g>
    ),
  },
  /** The product's own figure: the opening screen and the signature on an answer. */
  mascot: {
    accent: "#5cc2f5",
    accentDeep: "#2a8cc2",
    eye: "#c5ecff",
    gear: () => <Antenna colour="#f2a93b" />,
    prop: (ids) => (
      <g className="ap-wave-arm">
        <path d="M92 104c6-8 11-17 14-27" stroke={`url(#${ids.suit})`} strokeWidth="12" strokeLinecap="round" fill="none" />
        <circle cx="107" cy="71" r="8.5" fill={`url(#${ids.shell})`} />
      </g>
    ),
  },
};

const UNKNOWN: Trade = { accent: "#93a4ba", accentDeep: "#62748a", eye: "#d9e3ef" };

export const AVATARS = ["planner", "searcher", "analyst", "timekeeper", "cataloger", "reviewer", "charter", "operator", "helper", "mascot"] as const;

export function AgentPortrait({
  avatar,
  label,
  active = false,
  size,
  className,
}: {
  /** One of `AVATARS`; anything else draws a neutral figure. */
  avatar: string;
  /** What a screen reader calls the figure: the agent's name. */
  label?: string;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const trade = TRADES[avatar] ?? UNKNOWN;
  const ids: Ids = {
    accent: `${uid}a`,
    glow: `${uid}g`,
    suit: `${uid}s`,
    shell: `${uid}h`,
    visor: `${uid}v`,
  };
  const style: CSSProperties | undefined = size ? { width: size, height: size } : undefined;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={["agent-portrait", className].filter(Boolean).join(" ")}
      data-active={active || undefined}
      data-avatar={avatar}
      style={style}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={ids.accent} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={trade.accent} />
            <stop offset="1" stopColor={trade.accentDeep} />
          </linearGradient>
          <radialGradient id={ids.glow} cx=".5" cy=".42" r=".62">
            <stop offset="0" stopColor={trade.accent} stopOpacity=".34" />
            <stop offset="1" stopColor={trade.accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ids.suit} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#47689a" />
            <stop offset="1" stopColor={STEEL} />
          </linearGradient>
          <radialGradient id={ids.shell} cx=".36" cy=".26" r=".85">
            <stop offset="0" stopColor="#fffdf8" />
            <stop offset=".62" stopColor="#ece6da" />
            <stop offset="1" stopColor="#c6bfb1" />
          </radialGradient>
          <linearGradient id={ids.visor} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1626" />
            <stop offset="1" stopColor="#1b2f4b" />
          </linearGradient>
        </defs>

        <circle cx="60" cy="60" r="58" fill={`url(#${ids.glow})`} />

        {/* Shoulders first, so the collar sits under the chin. */}
        <path d="M22 120c-1-24 15-37 38-37s39 13 38 37Z" fill={`url(#${ids.suit})`} />
        <path d="M45 84.5 60 97l15-12.5" fill="none" stroke={`url(#${ids.accent})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        <g className="ap-head">
          <circle cx="29" cy="46" r="6" fill={`url(#${ids.accent})`} />
          <circle cx="91" cy="46" r="6" fill={`url(#${ids.accent})`} />
          <path d="M60 14c19 0 31 13 31 31 0 22-14 32-31 32S29 67 29 45c0-18 12-31 31-31Z" fill={`url(#${ids.shell})`} />
          <rect x="36" y="33" width="48" height="25" rx="12.5" fill={`url(#${ids.visor})`} />
          <rect x="36" y="33" width="48" height="25" rx="12.5" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.2" />
          <g className="ap-eyes">
            <rect className="ap-eye" x="45.5" y="39.5" width="7.5" height="12" rx="3.75" fill={trade.eye} />
            <rect className="ap-eye" x="67" y="39.5" width="7.5" height="12" rx="3.75" fill={trade.eye} />
          </g>
          <path d="M53.5 65c4.3 3 8.7 3 13 0" fill="none" stroke="#8d8676" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="47" cy="23.5" rx="10" ry="4.5" fill="#fff" fillOpacity=".75" transform="rotate(-24 47 23.5)" />
          {trade.gear?.(ids)}
        </g>

        {trade.prop?.(ids)}
      </svg>
    </span>
  );
}
