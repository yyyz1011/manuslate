export interface DiffLine { kind: "same" | "add" | "remove"; text: string }

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) matrix[i][j] = a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  }
  const result: DiffLine[] = [];
  let i = 0; let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ kind: "same", text: a[i] }); i += 1; j += 1; }
    else if (j < b.length && (i === a.length || matrix[i][j + 1] >= matrix[i + 1][j])) { result.push({ kind: "add", text: b[j] }); j += 1; }
    else { result.push({ kind: "remove", text: a[i] }); i += 1; }
  }
  return result;
}
