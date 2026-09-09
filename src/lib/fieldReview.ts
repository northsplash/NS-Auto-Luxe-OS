import { CLOSE_AFTER_KNOCK } from './canvass';
import { srStatus } from './salesRabbitLeads';

/** Any door-shaped record from demo OS, live leads, or territory pins. */
export type FieldDoor = {
  id: string;
  address: string;
  status: string;
  follow_up_at?: string | null;
  hot?: boolean;
  owner?: string;
  name?: string | null;
  phone?: string | null;
  lat?: number;
  lng?: number;
};

const HOUSE_RE = /^(\d+[A-Za-z]?)\s+/;
const CLOSED_WALK = new Set([
  'sold', 'customer', 'do_not_knock', 'not_interested', 'cancelled', 'lost',
]);

export function houseNumber(address: string): number {
  const m = String(address || '').trim().match(/^(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export function streetName(address: string): string {
  const stripped = String(address || '')
    .replace(HOUSE_RE, '')
    .replace(/,\s*[^,]+,\s*[A-Z]{2}.*$/, '')
    .trim();
  return stripped || String(address || '').trim() || 'Unnamed street';
}

export function isClosedDoor(status: string): boolean {
  return CLOSED_WALK.has(srStatus(status).key);
}

/** After a quick knock (NA, revisit, DNK) keep walking instead of staying on the sheet. */
export function advancesAfterKnock(status: string): boolean {
  const key = srStatus(status).key;
  return CLOSE_AFTER_KNOCK.has(key) && key !== 'unworked';
}

export function isFollowUpDue(followUpAt?: string | null, now = Date.now()): boolean {
  if (!followUpAt) return false;
  const iso = Date.parse(followUpAt);
  if (Number.isFinite(iso)) return iso <= now;
  const m = followUpAt.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return false;
  const day = Date.parse(`${m[1]}T17:00:00`);
  return Number.isFinite(day) && day <= now;
}

export function doorPriority(door: FieldDoor, now = Date.now()): number {
  let score = srStatus(door.status).priority;
  if (isFollowUpDue(door.follow_up_at, now)) score += 40;
  if (door.hot) score += 12;
  if (srStatus(door.status).key === 'unworked') score += 4;
  return score;
}

export function walkStreet(doors: FieldDoor[], street: string): FieldDoor[] {
  return doors
    .filter((d) => streetName(d.address) === street)
    .sort((a, b) => houseNumber(a.address) - houseNumber(b.address) || a.address.localeCompare(b.address));
}

export function nextOnStreet(doors: FieldDoor[], currentId: string): FieldDoor | null {
  const current = doors.find((d) => d.id === currentId);
  if (!current) return null;
  const street = walkStreet(doors, streetName(current.address));
  const idx = street.findIndex((d) => d.id === currentId);
  if (idx < 0) return null;
  for (let i = idx + 1; i < street.length; i++) {
    if (!isClosedDoor(street[i].status)) return street[i];
  }
  for (let i = 0; i < idx; i++) {
    if (!isClosedDoor(street[i].status)) return street[i];
  }
  return null;
}

export function prevOnStreet(doors: FieldDoor[], currentId: string): FieldDoor | null {
  const current = doors.find((d) => d.id === currentId);
  if (!current) return null;
  const street = walkStreet(doors, streetName(current.address));
  const idx = street.findIndex((d) => d.id === currentId);
  if (idx < 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (!isClosedDoor(street[i].status)) return street[i];
  }
  for (let i = street.length - 1; i > idx; i--) {
    if (!isClosedDoor(street[i].status)) return street[i];
  }
  return null;
}

/** Highest-priority open door, preferring the current street. */
export function nextBestDoor(doors: FieldDoor[], currentId?: string | null, now = Date.now()): FieldDoor | null {
  const open = doors.filter((d) => !isClosedDoor(d.status));
  if (!open.length) return null;
  const current = currentId ? doors.find((d) => d.id === currentId) : null;
  const street = current ? streetName(current.address) : '';
  const scored = [...open].sort((a, b) => {
    const streetBias =
      (streetName(b.address) === street ? 1 : 0) - (streetName(a.address) === street ? 1 : 0);
    if (streetBias) return streetBias;
    return doorPriority(b, now) - doorPriority(a, now) || houseNumber(a.address) - houseNumber(b.address);
  });
  const first = scored[0];
  if (first && first.id !== currentId) return first;
  return scored.find((d) => d.id !== currentId) ?? null;
}

export function streetProgress(doors: FieldDoor[], street: string) {
  const on = doors.filter((d) => streetName(d.address) === street);
  const closed = on.filter((d) => isClosedDoor(d.status)).length;
  const worked = on.filter((d) => srStatus(d.status).key !== 'unworked').length;
  return { street, total: on.length, closed, worked, open: on.length - closed };
}

export type StreetGroup<T extends FieldDoor> = {
  street: string;
  items: T[];
  closed: number;
  worked: number;
  total: number;
};

export function groupByStreet<T extends FieldDoor>(doors: T[]): StreetGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const d of doors) {
    const s = streetName(d.address);
    if (!map.has(s)) {
      map.set(s, []);
      order.push(s);
    }
    map.get(s)!.push(d);
  }
  return order.map((street) => {
    const items = [...(map.get(street) || [])].sort(
      (a, b) => houseNumber(a.address) - houseNumber(b.address) || a.address.localeCompare(b.address),
    );
    const closed = items.filter((d) => isClosedDoor(d.status)).length;
    const worked = items.filter((d) => srStatus(d.status).key !== 'unworked').length;
    return { street, items, closed, worked, total: items.length };
  });
}

export type ReviewQueues<T extends FieldDoor> = {
  due: T[];
  hot: T[];
  fresh: T[];
  callbacks: T[];
};

export function reviewQueues<T extends FieldDoor>(doors: T[], now = Date.now()): ReviewQueues<T> {
  const due = doors.filter((d) => isFollowUpDue(d.follow_up_at, now) && !isClosedDoor(d.status));
  const hot = doors.filter((d) => d.hot && !isClosedDoor(d.status));
  const fresh = doors.filter((d) => srStatus(d.status).key === 'unworked');
  const callbacks = doors.filter((d) => {
    const key = srStatus(d.status).key;
    return key === 'revisit' || key === 'follow_up' || key === 'no_answer';
  });
  const byPri = (a: T, b: T) => doorPriority(b, now) - doorPriority(a, now);
  return {
    due: [...due].sort(byPri),
    hot: [...hot].sort(byPri),
    fresh: [...fresh].sort(byPri),
    callbacks: [...callbacks].sort(byPri),
  };
}

export function rankedOpenDoors<T extends FieldDoor>(doors: T[], now = Date.now()): T[] {
  return [...doors].filter((d) => !isClosedDoor(d.status)).sort((a, b) => doorPriority(b, now) - doorPriority(a, now));
}

export function doorNextAction(door: FieldDoor, now = Date.now()): { text: string; overdue: boolean } {
  const pin = srStatus(door.status);
  if (isFollowUpDue(door.follow_up_at, now)) {
    return { text: door.follow_up_at ? `Callback due · ${door.follow_up_at}` : 'Callback due', overdue: true };
  }
  if (door.follow_up_at) return { text: `Callback · ${door.follow_up_at}`, overdue: false };
  if (pin.key === 'unworked') return { text: 'Knock this door', overdue: false };
  if (pin.key === 'no_answer') return { text: 'Try again', overdue: false };
  if (pin.key === 'revisit') return { text: 'Revisit this house', overdue: false };
  if (pin.key === 'interested') return { text: 'Quote or book a window', overdue: false };
  if (pin.key === 'estimate') return { text: 'Present the estimate', overdue: false };
  if (pin.key === 'appointment_set') return { text: 'Confirm the appointment', overdue: false };
  if (pin.key === 'follow_up') return { text: 'Set a callback time', overdue: false };
  if (pin.key === 'sold' || pin.key === 'customer') return { text: 'Won — convert to a job', overdue: false };
  return { text: pin.name, overdue: false };
}
