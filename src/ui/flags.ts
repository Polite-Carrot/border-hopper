import data from '../data/flags.generated.json';

const FLAGS = (data as { flags: Record<string, string> }).flags;
const uris = new Map<string, string>();

/**
 * A country's flag as an image URL for an SVG `<Image>`, or undefined if
 * there is none. Built once per flag and kept, since the explorer asks for his
 * on every render.
 */
export function flagImage(iso: string): string | undefined {
  const cached = uris.get(iso);
  if (cached) return cached;
  const svg = FLAGS[iso];
  if (!svg) return undefined;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  uris.set(iso, uri);
  return uri;
}
