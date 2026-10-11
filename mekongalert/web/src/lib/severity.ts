// §6.3: severity color band, 1 green -> 5 red.
const COLORS = ["", "#52c41a", "#bae637", "#faad14", "#fa8c16", "#f5222d"];

export function severityColor(severity: number): string {
  return COLORS[severity] ?? "#999";
}
