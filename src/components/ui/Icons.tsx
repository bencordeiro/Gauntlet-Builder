/**
 * Icon set.
 *
 * Hand-drawn inline SVGs at a consistent 16px grid with 1.5 stroke, rather than
 * an icon dependency — it keeps the bundle self-contained and the visual weight
 * uniform. All icons inherit `currentColor` and are hidden from assistive tech
 * unless given a title.
 */

interface IconProps {
  size?: number;
  className?: string;
  title?: string;
}

function base({ size = 16, className, title }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': title ? undefined : true,
    role: title ? ('img' as const) : undefined,
  };
}

const T = ({ title }: { title?: string }) => (title ? <title>{title}</title> : null);

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M3.5 6 8 10.5 12.5 6" />
  </svg>
);

export const ChevronUp = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M3.5 10 8 5.5 12.5 10" />
  </svg>
);

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M10 3.5 5.5 8 10 12.5" />
  </svg>
);

export const Check = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
);

export const Plus = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);

export const X = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const Trash = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M2.5 4.5h11M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8" />
  </svg>
);

export const Copy = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </svg>
);

export const Download = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 2.5v7M5 7l3 3 3-3M2.5 12v1a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-1" />
  </svg>
);

export const Upload = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 10.5v-8M5 5.5l3-3 3 3M2.5 12v1a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-1" />
  </svg>
);

export const Printer = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M4.5 6.5v-4h7v4M4.5 12.5h-2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2" />
    <rect x="4.5" y="9.5" width="7" height="4" rx="0.5" />
  </svg>
);

export const Search = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </svg>
);

export const Grid = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </svg>
);

export const Layers = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z" />
    <path d="m2.4 8 5.6 2.9L13.6 8M2.4 11l5.6 2.9L13.6 11" />
  </svg>
);

export const Bookmark = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.2a.3.3 0 0 1-.47.25L8 10.6l-4.03 2.85a.3.3 0 0 1-.47-.25V3a.5.5 0 0 1 .5-.5Z" />
  </svg>
);

export const Settings = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
  </svg>
);

export const Sparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 1.8 9.5 6 13.7 7.5 9.5 9 8 13.2 6.5 9 2.3 7.5 6.5 6 8 1.8Z" />
  </svg>
);

export const Warning = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 2.4 14.5 13a.6.6 0 0 1-.5.9H2a.6.6 0 0 1-.5-.9L8 2.4Z" />
    <path d="M8 6.4v3.2M8 11.9v.1" />
  </svg>
);

export const Info = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.3v4M8 4.9v.1" />
  </svg>
);

export const AlertCircle = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8v3.6M8 10.9v.1" />
  </svg>
);

export const CheckCircle = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="6" />
    <path d="M5.4 8.2 7.2 10l3.4-3.6" />
  </svg>
);

export const Lightbulb = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M6 12.5h4M6.5 14h3M5 8.8a3.6 3.6 0 1 1 6 0c-.6.8-1 1.3-1 2.2H6c0-.9-.4-1.4-1-2.2Z" />
  </svg>
);

export const Duplicate = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" />
    <path d="M6.5 12.5v.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-.5" />
  </svg>
);

export const Edit = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M10.6 2.9a1.3 1.3 0 0 1 1.9 1.9L5.4 11.9l-2.6.7.7-2.6 7.1-7.1Z" />
  </svg>
);

export const Eye = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M1.5 8S3.8 3.8 8 3.8 14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="1.9" />
  </svg>
);

export const Sun = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.3M8 13.2v1.3M14.5 8h-1.3M2.8 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" />
  </svg>
);

export const Moon = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M13.5 9.4A5.8 5.8 0 0 1 6.6 2.5a5.8 5.8 0 1 0 6.9 6.9Z" />
  </svg>
);

export const Users = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="6" cy="5.5" r="2.3" />
    <path d="M1.8 13.2a4.3 4.3 0 0 1 8.4 0M10.6 3.5a2.3 2.3 0 0 1 0 4.4M11.8 9.4a4.3 4.3 0 0 1 2.4 3.8" />
  </svg>
);

export const Flow = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <rect x="1.8" y="2" width="4.4" height="3.2" rx="0.8" />
    <rect x="9.8" y="10.8" width="4.4" height="3.2" rx="0.8" />
    <path d="M4 5.2v4a1.5 1.5 0 0 0 1.5 1.5H12M12 10.8V8" />
  </svg>
);

export const Shield = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M8 1.8 13 3.6v4.1c0 3-2.1 5.4-5 6.5-2.9-1.1-5-3.5-5-6.5V3.6L8 1.8Z" />
  </svg>
);

export const Clock = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.6V8l2.3 1.6" />
  </svg>
);

export const File = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M9.2 1.8H4a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.6L9.2 1.8Z" />
    <path d="M9 2v3.5h3.8" />
  </svg>
);

export const Refresh = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M13.5 7a5.5 5.5 0 0 0-9.6-2.6L1.9 6.3M2.5 9a5.5 5.5 0 0 0 9.6 2.6l2-1.9" />
    <path d="M1.8 3.4v2.9h2.9M14.2 12.6V9.7h-2.9" />
  </svg>
);

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <T title={p.title} />
    <path d="M2.5 8h11M9.5 4l4 4-4 4" />
  </svg>
);
