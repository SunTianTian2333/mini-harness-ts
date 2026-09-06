function cronFieldMatches(field: string, value: number): boolean {
  if (field === "*") {
    return true;
  }
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    return value % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").some((part) => cronFieldMatches(part.trim(), value));
  }
  if (field.includes("-")) {
    const [start, end] = field.split("-", 2);
    return Number(start) <= value && value <= Number(end);
  }
  return value === Number(field);
}

export function cronMatches(cronExpr: string, moment: Date): boolean {
  const fields = cronExpr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }

  const [minute, hour, day, month, weekday] = fields;
  const cronWeekday = moment.getDay();

  if (
    !cronFieldMatches(minute!, moment.getMinutes()) ||
    !cronFieldMatches(hour!, moment.getHours()) ||
    !cronFieldMatches(month!, moment.getMonth() + 1)
  ) {
    return false;
  }

  const dayMatches = cronFieldMatches(day!, moment.getDate());
  const weekdayMatches = cronFieldMatches(weekday!, cronWeekday);

  if (day === "*" && weekday === "*") {
    return true;
  }
  if (day === "*") {
    return weekdayMatches;
  }
  if (weekday === "*") {
    return dayMatches;
  }
  return dayMatches || weekdayMatches;
}

export function minuteMarker(moment: Date): string {
  const year = moment.getFullYear();
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  const hours = String(moment.getHours()).padStart(2, "0");
  const minutes = String(moment.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
