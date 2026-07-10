import { useCallback, useRef, useState } from 'react';

// The Share clipboard lifecycle, shared by the single-factory (useShareFactory) and
// multi-factory (useShareFactories) hooks. It is driven by the *actual* clipboard
// result rather than by "the POST returned a key" (see #182): on a cold-started
// server the write could be pushed past the click's user-activation window and
// silently rejected, yet the UI would still claim success. We only celebrate once
// the clipboard resolves, and fall back to a manual-copy field when it doesn't.
export type ShareStatus = 'idle' | 'copying' | 'copied' | 'failed';

// How long the success feedback lingers before auto-dismissing. The failure state is
// deliberately sticky — it hosts the manual-copy field — so it is never auto-closed.
const COPIED_DISMISS_MS = 2500;

// Drives status/link off a single `linkPromise` (the awaited share-link generation).
// The promise must reject when there is no link to offer so the flow drops to the
// manual-copy fallback. Callers own generating the promise (one POST or a batch).
export function useClipboardShare() {
  const [status, setStatus] = useState<ShareStatus>('idle');
  // The resolved link, kept so the manual-copy fallback always has something to show
  // even when the clipboard write itself was rejected.
  const [link, setLink] = useState('');
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(async (linkPromise: Promise<string>) => {
    clearTimeout(dismissTimer.current);
    setStatus('copying');
    setLink('');

    const markCopied = () => {
      setStatus('copied');
      dismissTimer.current = setTimeout(() => setStatus('idle'), COPIED_DISMISS_MS);
    };

    try {
      // Async clipboard write: hand the browser a *pending* Blob via ClipboardItem so
      // the write stays authorized by this click across the await for the (possibly
      // cold-started) POST. A plain `await post; writeText(link)` runs after transient
      // activation has expired, which Edge/Safari reject silently — the #182 bug.
      const item = new ClipboardItem({
        'text/plain': linkPromise.then((l) => new Blob([l], { type: 'text/plain' })),
      });
      await navigator.clipboard.write([item]);
      setLink(await linkPromise);
      markCopied();
    } catch {
      // ClipboardItem / clipboard.write is unavailable (older or insecure context) or
      // the write was rejected. Recover the link for a best-effort plain-text write,
      // then drop to the manual-copy field so the link is never stranded.
      let resolved = '';
      try {
        resolved = await linkPromise;
      } catch {
        // Generation itself failed (e.g. the POST errored) — there is no link to offer.
      }
      setLink(resolved);
      if (resolved) {
        try {
          await navigator.clipboard?.writeText(resolved);
          markCopied();
          return;
        } catch {
          // Both clipboard paths rejected — fall through to the manual-copy field.
        }
      }
      setStatus('failed');
    }
  }, []);

  return { status, link, copy };
}
