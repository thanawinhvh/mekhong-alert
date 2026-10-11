const FLAGS: Record<string, string> = { TH: "🇹🇭", CN: "🇨🇳" };

export function countryFlag(country?: string | null): string {
  return (country && FLAGS[country]) ?? "";
}
