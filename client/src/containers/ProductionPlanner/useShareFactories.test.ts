import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the POST hook: succeed for every factory except gameVersion 'bad', which
// resolves to undefined (a failed POST). This lets us assert partial-failure counting
// without a real network round-trip.
vi.mock('../../api/modules/shared-factories/usePostSharedFactory', () => ({
  usePostSharedFactory: () => ({
    data: null,
    error: null,
    loading: false,
    completedThisFrame: false,
    request: async (req: { gameVersion: string }) =>
      req.gameVersion === 'bad' ? undefined : { key: `key-${req.gameVersion}` },
  }),
}));

import { useShareFactories } from './useShareFactories';
import { LibraryFactory } from '../../contexts/library/types';

function fac(gameVersion: string): LibraryFactory {
  return { id: `id-${gameVersion}`, gameVersion, config: {} as any, createdAt: 0, updatedAt: 0 };
}

// Real clipboard.write awaits each ClipboardItem's pending Blob and rejects if one
// rejects; the mock mirrors that so the "nothing shared" path (value promise throws)
// drops into the failed branch just like a browser.
const clipboardWrite = vi.fn().mockImplementation(async (items: any[]) => {
  await Promise.all(items.flatMap((i) => i._values));
});
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  clipboardWrite.mockClear();
  clipboardWriteText.mockClear();
  (globalThis as any).ClipboardItem = class {
    _values: Promise<Blob>[];
    constructor(items: Record<string, Promise<Blob>>) {
      this._values = Object.values(items);
      // Swallow rejections on a copy so they never surface as unhandled rejections.
      this._values.forEach((p) => p.catch(() => {}));
    }
  };
  Object.assign(navigator, { clipboard: { write: clipboardWrite, writeText: clipboardWriteText } });
});

describe('useShareFactories', () => {
  it('copies the combined link and reports full counts on all-success', async () => {
    const { result } = renderHook(() => useShareFactories());
    await act(async () => {
      await result.current.onShare([fac('1.2'), fac('1.1')]);
    });
    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('copied');
    expect(result.current.sharedCount).toBe(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.link).toContain('factory=key-1.2,key-1.1');
  });

  it('builds the link from successful keys and reports the shortfall on partial failure', async () => {
    const { result } = renderHook(() => useShareFactories());
    await act(async () => {
      await result.current.onShare([fac('1.2'), fac('bad'), fac('1.1')]);
    });
    expect(result.current.status).toBe('copied');
    expect(result.current.sharedCount).toBe(2);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.link).toContain('factory=key-1.2,key-1.1');
  });

  it('falls back to the failed state when nothing was shared', async () => {
    const { result } = renderHook(() => useShareFactories());
    await act(async () => {
      await result.current.onShare([fac('bad'), fac('bad')]);
    });
    expect(result.current.status).toBe('failed');
    expect(result.current.sharedCount).toBe(0);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.link).toBe('');
  });
});
