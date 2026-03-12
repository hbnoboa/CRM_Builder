import type { CSSProperties } from 'react';

/** Recharts Tooltip contentStyle — theme-aware */
export const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  padding: '8px 12px',
  fontSize: '12px',
};

/** Recharts Tooltip label (top line) */
export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'hsl(var(--muted-foreground))',
  fontWeight: 500,
  marginBottom: 2,
};

/** Recharts Tooltip item lines */
export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: 'hsl(var(--card-foreground))',
  padding: 0,
};

/** Recharts axis tick style — theme-aware */
export const AXIS_TICK_STYLE = {
  fontSize: 10,
  fill: 'hsl(var(--muted-foreground))',
};

/** Recharts Legend wrapper style */
export const LEGEND_STYLE: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--muted-foreground))',
};
