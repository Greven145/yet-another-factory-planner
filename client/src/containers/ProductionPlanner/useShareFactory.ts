import { useCallback } from 'react';
import { useProductionContext } from '../../contexts/production';
import { useClipboardShare, ShareStatus } from './useClipboardShare';

// Single-factory Share: generate the active factory's link and copy it inside the
// click gesture. The clipboard lifecycle (and the #182 discipline) lives in
// useClipboardShare, shared with the multi-factory hook.
export type { ShareStatus };

export function useShareFactory() {
  const ctx = useProductionContext();
  const { status, link, copy } = useClipboardShare();

  const onShare = useCallback(() => {
    // generateShareLink rejects when the server never returned a key, which drops the
    // clipboard flow to its manual-copy fallback.
    return copy(ctx.generateShareLink());
  }, [ctx, copy]);

  return { status, link, onShare };
}
