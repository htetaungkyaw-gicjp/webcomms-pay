"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-GB": enGB },
});

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
};

// Color by event_type (M3-ish container tones). Status is never color-only — the
// event title carries the meaning; color is supplementary.
const TYPE_COLOR: Record<string, string> = {
  general: "#4f46e5",
  holiday: "#2e6a45",
  exam: "#ba1a1a",
  activity: "#79536a",
  meeting: "#5b5d72",
};

/**
 * Month/week calendar (DESIGN.md Calendar tab). Client component because month
 * navigation needs client state. Color-coded by event_type.
 */
export function CalendarView({ events }: { events: EventRow[] }) {
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(() => new Date());

  const mapped = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.starts_at),
        end: new Date(e.ends_at),
        resource: e.event_type,
      })),
    [events],
  );

  return (
    <div className="rounded-[16px] bg-surface p-3" style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        events={mapped}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
        popup
        eventPropGetter={(event: { resource?: string }) => ({
          style: {
            backgroundColor: TYPE_COLOR[event.resource ?? "general"] ?? "#4f46e5",
            border: "none",
            borderRadius: 8,
          },
        })}
      />
    </div>
  );
}
