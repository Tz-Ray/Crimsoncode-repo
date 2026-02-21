import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";

export function buildMonthGrid(anchorDate: Date) {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sun
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let current = gridStart;

  while (current <= gridEnd) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function isCurrentMonth(day: Date, anchorDate: Date) {
  return isSameMonth(day, anchorDate);
}

export { format, isToday, isSameDay };