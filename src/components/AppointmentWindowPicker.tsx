import {
  clockLabel,
  durationLabel,
  isPastSlot,
  joinLocalInput,
  minutesToHm,
  splitLocalInput,
  upcomingDays,
  windowSummary,
  workDaySlotMinutes,
  type UpcomingDay,
} from '@/lib/scheduling';

export type OccupiedReason = string | false;

type Props = {
  value: string;
  onChange: (next: string) => void;
  durationMinutes?: number;
  bufferMinutes?: number;
  timezoneLabel?: string;
  techLabel?: string;
  busy?: boolean;
  compact?: boolean;
  dayCount?: number;
  skipWeekdays?: number[];
  occupyChecker?: (ymd: string, hm: string) => OccupiedReason;
  suggestion?: { value: string; label: string } | null;
  onAcceptSuggestion?: () => void;
  onKeepRequested?: () => void;
  onFindOpen?: () => void;
  emptyText?: string;
};

const GROUPS: Array<{ id: string; label: string; test: (mins: number) => boolean }> = [
  { id: 'morning', label: 'Morning', test: (m) => m < 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', test: (m) => m >= 12 * 60 && m < 17 * 60 },
  { id: 'evening', label: 'Evening', test: (m) => m >= 17 * 60 },
];

function defaultValue(days: UpcomingDay[]) {
  const now = new Date();
  const ymd = days[0]?.ymd;
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  if (rounded.getMinutes() % 30) rounded.setMinutes(Math.ceil(rounded.getMinutes() / 30) * 30);
  const hm = days[0]?.isToday ? minutesToHm(rounded.getHours() * 60 + rounded.getMinutes()) : '09:00';
  return joinLocalInput(ymd || `${now.getFullYear()}-01-01`, hm);
}

export default function AppointmentWindowPicker({
  value,
  onChange,
  durationMinutes = 120,
  bufferMinutes = 30,
  timezoneLabel = 'ET',
  techLabel,
  busy,
  compact,
  dayCount = 14,
  skipWeekdays = [],
  occupyChecker,
  suggestion,
  onAcceptSuggestion,
  onKeepRequested,
  onFindOpen,
  emptyText = 'No open windows on this day. Pick another date or shorten the job.',
}: Props) {
  const days = upcomingDays(dayCount, new Date(), skipWeekdays);
  const parsed = splitLocalInput(value);
  const ymd = parsed.ymd && days.some((d) => d.ymd === parsed.ymd) ? parsed.ymd : (days[0]?.ymd || parsed.ymd);
  const hm = parsed.hm || '09:00';
  const summary = windowSummary(ymd, hm, durationMinutes, bufferMinutes, timezoneLabel);
  const slots = workDaySlotMinutes().map((mins) => {
    const slotHm = minutesToHm(mins);
    const past = isPastSlot(ymd, slotHm);
    const occupied = occupyChecker?.(ymd, slotHm) || false;
    const reason = past ? 'This window already passed.' : occupied || '';
    return { hm: slotHm, mins, available: !reason, reason };
  });
  const selectedTaken = slots.find((s) => s.hm === hm && !s.available);

  const pickDay = (nextYmd: string) => {
    const open = workDaySlotMinutes()
      .map(minutesToHm)
      .find((slotHm) => !isPastSlot(nextYmd, slotHm) && !occupyChecker?.(nextYmd, slotHm));
    onChange(joinLocalInput(nextYmd, open || hm));
  };

  const ensureValue = () => {
    if (!value) onChange(defaultValue(days));
  };

  return (
    <div className={`appt-window-picker ${compact ? 'compact' : ''}`}>
      <div className="appt-window-label">
        <span>When</span>
        <small>{timezoneLabel} · {durationLabel(durationMinutes)} on site{bufferMinutes ? ` · ${bufferMinutes} min travel after` : ''}</small>
      </div>
      <div className="appt-day-strip" role="tablist" aria-label="Pick a day">
        {days.map((d) => (
          <button
            key={d.ymd}
            type="button"
            role="tab"
            aria-selected={d.ymd === ymd}
            className={`${d.ymd === ymd ? 'active' : ''} ${d.isToday ? 'is-today' : ''} ${d.weekdayIndex === 0 ? 'is-sunday' : ''}`}
            onClick={() => pickDay(d.ymd)}
          >
            <small>{d.isToday ? 'Today' : d.weekday}</small>
            <strong>{d.day}</strong>
            <em>{d.month}</em>
          </button>
        ))}
      </div>
      {suggestion && (
        <div className="appt-suggest">
          <div>
            <strong>Next open window</strong>
            <span>{suggestion.label}</span>
          </div>
          <div className="appt-suggest-actions">
            {onAcceptSuggestion && <button type="button" className="btn-primary" onClick={onAcceptSuggestion}>Use this window</button>}
            {onKeepRequested && <button type="button" className="btn-outline" onClick={onKeepRequested}>Keep my time</button>}
          </div>
        </div>
      )}
      {busy && <p className="appt-window-busy">Checking drive time and the board…</p>}
      {GROUPS.map((group) => {
        const items = slots.filter((s) => group.test(s.mins));
        if (!items.length) return null;
        return (
          <div className="appt-slot-group" key={group.id}>
            <span>{group.label}</span>
            <div className="appt-time-grid">
              {items.map((slot) => (
                <button
                  key={slot.hm}
                  type="button"
                  disabled={!slot.available}
                  title={slot.reason || clockLabel(slot.hm)}
                  className={`appt-time-chip ${slot.hm === hm ? 'active' : ''} ${slot.available ? '' : 'taken'}`}
                  onClick={() => { ensureValue(); onChange(joinLocalInput(ymd, slot.hm)); }}
                >
                  {clockLabel(slot.hm)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!slots.some((s) => s.available) && <p className="appt-window-empty">{emptyText}</p>}
      {selectedTaken && <p className="appt-window-conflict" role="alert">{selectedTaken.reason}</p>}
      <div className="appt-window-summary">
        <strong>{summary.headline}</strong>
        <span>
          {summary.durationText} on site
          {summary.bufferText ? ` · ${summary.bufferText}` : ''}
          {techLabel ? ` · ${techLabel}` : ''}
        </span>
        {onFindOpen && (
          <button type="button" className="appt-find-open" onClick={onFindOpen}>Find next open window</button>
        )}
      </div>
    </div>
  );
}
