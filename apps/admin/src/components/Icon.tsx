/** Tiny hand-drawn stroke icon set for the sidebar. */
const PATHS: Record<string, string> = {
  dashboard: 'M2 2h5v5H2zM9 2h5v3H9zM9 7h5v7H9zM2 9h5v5H2z',
  chart: 'M2 14h12M4 11V7m3.5 4V4m3.5 7V6m3.5 5V9',
  box: 'M2 5l6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6',
  layers: 'M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3',
  clipboard: 'M5 3h6v2H5zM5 3H3v11h10V3h-2M5 8h6M5 11h4',
  bag: 'M4 5h8l1 9H3zM6 5a2 2 0 114 0',
  truck: 'M1 4h8v7H1zM9 6h3l2 2v3H9zM4 13a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8zM11.5 13a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8z',
  undo: 'M3 6h7a3.5 3.5 0 010 7H5M3 6l3-3M3 6l3 3',
  card: 'M2 4h12v8H2zM2 7h12M4 10h3',
  users: 'M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 8a2 2 0 100-4M11.5 10c1.8.3 3 1.6 3 3.5',
  ticket: 'M2 5h12v2.5a1.5 1.5 0 000 3V13H2v-2.5a1.5 1.5 0 000-3zM9 5v8',
  shield: 'M8 2l5 2v4c0 3.5-2.2 5.3-5 6-2.8-.7-5-2.5-5-6V4z',
  layout: 'M2 2h12v12H2zM2 6h12M6 6v8',
  globe: 'M8 1.6a6.4 6.4 0 100 12.8A6.4 6.4 0 008 1.6zM1.8 8h12.4M8 1.6c1.7 1.7 2.6 3.9 2.6 6.4S9.7 12.7 8 14.4C6.3 12.7 5.4 10.5 5.4 8s.9-4.7 2.6-6.4z',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={PATHS[name] ?? PATHS.box}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
