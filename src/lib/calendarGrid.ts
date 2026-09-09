import { WORK_DAY_END_MINUTES, WORK_DAY_START_MINUTES, dayKey } from './scheduling';

export const CAL_START = WORK_DAY_START_MINUTES;
export const CAL_END = WORK_DAY_END_MINUTES;
export const CAL_HOUR_PX = 56;

export type TimedItem = {
  id: string;
  startMin: number;
  endMin: number;
};

export type PackedItem<T extends TimedItem> = T & { col: number; cols: number };

export function parseYmd(ymd: string) {
  return new Date(`${ymd}T12:00:00`);
}

export function startOfWeek(d: Date) {
  const next = new Date(d);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function daysOfWeek(d: Date) {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function monthCells(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
}

export function nowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function hoursInGrid(start = CAL_START, end = CAL_END) {
  const hours: number[] = [];
  for (let m = start; m < end; m += 60) hours.push(m);
  return hours;
}

export function packDay<T extends TimedItem>(items: T[]): PackedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Array<T & { col: number }> = [];
  for (const ev of sorted) {
    let col = 0;
    while (placed.some((n) => n.col === col && n.startMin < ev.endMin && ev.startMin < n.endMin)) col += 1;
    placed.push({ ...ev, col });
  }
  return placed.map((ev) => {
    const cluster = placed.filter((n) => n.startMin < ev.endMin && ev.startMin < n.endMin);
    const cols = Math.max(1, ...cluster.map((n) => n.col + 1));
    return { ...ev, cols };
  });
}

export function eventBox(startMin: number, endMin: number, gridStart = CAL_START, gridEnd = CAL_END) {
  const span = Math.max(1, gridEnd - gridStart);
  const start = Math.min(gridEnd - 15, Math.max(gridStart, startMin));
  const end = Math.max(start + 20, Math.min(gridEnd, endMin));
  return {
    top: ((start - gridStart) / span) * 100,
    height: ((end - start) / span) * 100,
  };
}

export function slotFromOffset(offsetY: number, height: number, gridStart = CAL_START, gridEnd = CAL_END, step = 30) {
  const span = gridEnd - gridStart;
  const raw = gridStart + (offsetY / Math.max(1, height)) * span;
  return Math.round(raw / step) * step;
}

export function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

export function weekdayShort(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function monthTitle(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
