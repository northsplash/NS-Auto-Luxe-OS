import { useEffect, useMemo, useState } from 'react';
import { CAL_END, CAL_HOUR_PX, CAL_START, eventBox, hoursInGrid, nowMinutes, packDay, slotFromOffset, type TimedItem } from '@/lib/calendarGrid';
import { clockLabel, dayKey, minutesToHm } from '@/lib/scheduling';

export type CalTone = 'gold' | 'green' | 'blue' | 'muted' | 'live' | 'warn';

export type CalendarBlock = TimedItem & {
  ymd: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: CalTone;
};

type Props = {
  days: Date[];
  events: CalendarBlock[];
  selectedYmd?: string;
  hourPx?: number;
  readOnly?: boolean;
  onSlot?: (ymd: string, minutes: number) => void;
  onEvent?: (id: string) => void;
  onDropEvent?: (id: string, ymd: string, minutes: number) => void;
};

function HourLabel({ minutes }: { minutes: number }) {
  const hm = minutesToHm(minutes);
  return <span>{clockLabel(hm)}</span>;
}

export default function TimedCalendarGrid({
  days,
  events,
  selectedYmd,
  hourPx = CAL_HOUR_PX,
  readOnly,
  onSlot,
  onEvent,
  onDropEvent,
}: Props) {
  const hours = hoursInGrid();
  const height = hours.length * hourPx;
  const today = dayKey(new Date());
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowMinutes()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const d of days) map.set(dayKey(d), []);
    for (const ev of events) {
      const list = map.get(ev.ymd);
      if (list) list.push(ev);
    }
    return map;
  }, [days, events]);
  const nowTop = eventBox(now, now + 1).top;
  const showNow = now >= CAL_START && now <= CAL_END;

  return (
    <div className="cal8-grid" style={{ ['--cal-hour' as string]: `${hourPx}px` }}>
      <div className="cal8-times" aria-hidden>
        <div className="cal8-times-pad" />
        {hours.map((m) => (
          <div className="cal8-time" key={m} style={{ height: hourPx }}>
            <HourLabel minutes={m} />
          </div>
        ))}
      </div>
      <div className={`cal8-cols cal8-cols-${Math.min(7, days.length)}`}>
        {days.map((d) => {
          const ymd = dayKey(d);
          const packed = packDay(byDay.get(ymd) || []);
          const isToday = ymd === today;
          const isSelected = ymd === selectedYmd;
          return (
            <div
              key={ymd}
              className={`cal8-col ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
              onClick={(e) => {
                if (readOnly || !onSlot) return;
                if ((e.target as HTMLElement).closest('.cal8-event')) return;
                const col = e.currentTarget.querySelector('.cal8-canvas') as HTMLElement | null;
                if (!col) return;
                const rect = col.getBoundingClientRect();
                const mins = slotFromOffset(e.clientY - rect.top, rect.height);
                onSlot(ymd, mins);
              }}
              onDragOver={(e) => { if (onDropEvent) e.preventDefault(); }}
              onDrop={(e) => {
                if (!onDropEvent) return;
                e.preventDefault();
                const id = e.dataTransfer.getData('appointment') || e.dataTransfer.getData('job');
                if (!id) return;
                const col = e.currentTarget.querySelector('.cal8-canvas') as HTMLElement | null;
                if (!col) return;
                const rect = col.getBoundingClientRect();
                onDropEvent(id, ymd, slotFromOffset(e.clientY - rect.top, rect.height));
              }}
            >
              <div className="cal8-canvas" style={{ height }}>
                {hours.map((m) => (
                  <div className="cal8-hour" key={m} style={{ height: hourPx }}>
                    <i />
                  </div>
                ))}
                {showNow && isToday && (
                  <div className="cal8-now" style={{ top: `${nowTop}%` }}>
                    <b />
                    <span />
                  </div>
                )}
                {packed.map((ev) => {
                  const box = eventBox(ev.startMin, ev.endMin);
                  const width = 100 / ev.cols;
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      className={`cal8-event tone-${ev.tone || 'gold'}`}
                      style={{
                        top: `${box.top}%`,
                        height: `${box.height}%`,
                        left: `calc(${ev.col * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      draggable={Boolean(onDropEvent)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('appointment', ev.id);
                        e.dataTransfer.setData('job', ev.id);
                      }}
                      onClick={(e) => { e.stopPropagation(); onEvent?.(ev.id); }}
                    >
                      <strong>{ev.title}</strong>
                      <small>{clockLabel(minutesToHm(ev.startMin))}–{clockLabel(minutesToHm(ev.endMin))}</small>
                      {ev.subtitle ? <span>{ev.subtitle}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
