export function findArrayEnd(text: string): number {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

export function extractJsonArray(text: string): unknown[] {
  for (let position = 0; position < text.length; position += 1) {
    if (text[position] !== "[") {
      continue;
    }
    try {
      const slice = text.slice(position);
      const end = findArrayEnd(slice);
      if (end === -1) {
        continue;
      }
      const value = JSON.parse(slice.slice(0, end + 1)) as unknown;
      if (Array.isArray(value)) {
        return value;
      }
    } catch {
      continue;
    }
  }
  return [];
}
