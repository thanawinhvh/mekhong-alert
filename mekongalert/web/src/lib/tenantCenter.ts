// Rough tenant HQ coordinates, used to center the map before any alerts exist.
const CENTERS: Record<string, [number, number]> = {
  "mukdahan-ddpm": [16.545, 104.72],
  "qinzhou-emb": [21.95, 108.62],
};

const DEFAULT: [number, number] = [16.545, 104.72];

export function tenantCenter(slug?: string | null): [number, number] {
  return (slug && CENTERS[slug]) || DEFAULT;
}
