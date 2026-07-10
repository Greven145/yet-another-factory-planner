import { SHARE_QUERY_PARAM } from '../../contexts/gameData/consts';

// The most factories a single share link carries. Enforced on BOTH ends: the send
// side (ShareMultipleModal) caps selection, and the receive side (gameData) caps how
// many keys it fetches — extras past the cap surface as unresolved rows.
export const MAX_SHARE_FACTORIES = 50;

// Disabled-row reason shown when a factory can't be included because the selection
// (send) or the incoming set (receive) is already at the cap. Derived from the cap so
// the two stay in sync.
export const OVER_CAP_REASON = `Over the ${MAX_SHARE_FACTORIES}-factory limit`;

// Build the shareable URL for one or more factory keys. Keys are comma-joined
// UNENCODED (share keys are 16 lowercase hex chars, so they need no escaping and a
// raw comma keeps the link short). A single key yields `?factory=<key>` with no
// comma, so the existing single-share link is byte-for-byte unchanged.
export function buildShareUrl(keys: string[]): string {
  const value = keys.join(',');
  return `${window.location.protocol}//${window.location.host}${window.location.pathname}?${SHARE_QUERY_PARAM}=${value}`;
}

// Parse the `?factory=` value into a list of keys. Splits on comma, trims each, and
// drops empties (so a trailing comma or stray whitespace never yields a blank key).
// Returns [] for a null/empty param. The single-key link (no comma) yields one key.
export function parseShareKeys(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}
