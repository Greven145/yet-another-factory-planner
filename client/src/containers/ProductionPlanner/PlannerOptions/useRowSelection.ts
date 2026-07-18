import { useCallback, useState } from 'react';

// The Set-of-selected-ids state shared by every factory-picker modal (library
// manager, share-multiple, import picker). Each modal owns WHEN to reset/seed the
// selection (they differ — empty vs. default-checked), so only the state and the
// toggle live here.
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  return { selected, setSelected, toggle };
}
