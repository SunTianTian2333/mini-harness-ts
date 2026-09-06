function validateCronField(field: string, minimum: number, maximum: number): string | null {
  if (field === "*") {
    return null;
  }
  if (field.startsWith("*/")) {
    const step = field.slice(2);
    if (!/^\d+$/.test(step) || Number(step) <= 0) {
      return `Invalid step: ${field}`;
    }
    return null;
  }
  if (field.includes(",")) {
    for (const part of field.split(",")) {
      const error = validateCronField(part.trim(), minimum, maximum);
      if (error) {
        return error;
      }
    }
    return null;
  }
  if (field.includes("-")) {
    const [start, end] = field.split("-", 2);
    if (!start || !end || !/^\d+$/.test(start) || !/^\d+$/.test(end)) {
      return `Invalid range: ${field}`;
    }
    const startValue = Number(start);
    const endValue = Number(end);
    if (startValue > endValue) {
      return `Range start is greater than end: ${field}`;
    }
    if (startValue < minimum || endValue > maximum) {
      return `Range ${field} is outside [${minimum}-${maximum}]`;
    }
    return null;
  }
  if (!/^\d+$/.test(field)) {
    return `Invalid field: ${field}`;
  }
  const value = Number(field);
  if (value < minimum || value > maximum) {
    return `Value ${value} is outside [${minimum}-${maximum}]`;
  }
  return null;
}

const FIELD_RULES: Array<[string, number, number]> = [
  ["minute", 0, 59],
  ["hour", 0, 23],
  ["day-of-month", 1, 31],
  ["month", 1, 12],
  ["day-of-week", 0, 6],
];

export function validateCron(cronExpr: string): string | null {
  const fields = cronExpr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Expected 5 fields, got ${fields.length}`;
  }

  for (let index = 0; index < fields.length; index += 1) {
    const [name, minimum, maximum] = FIELD_RULES[index]!;
    const error = validateCronField(fields[index]!, minimum, maximum);
    if (error) {
      return `${name}: ${error}`;
    }
  }
  return null;
}
