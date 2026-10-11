// Citizen-facing province labels for the LIFF picker — tenant.name_en is the
// full agency name (verbose), not what a citizen expects in a picker.
const LABELS: Record<string, string> = {
  "mukdahan-ddpm": "มุกดาหาร (Thailand)",
  "qinzhou-emb": "钦州 (China)",
};

export function provinceLabel(tenantSlug: string): string {
  return LABELS[tenantSlug] ?? tenantSlug;
}
