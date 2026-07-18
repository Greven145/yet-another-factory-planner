// The receive side of multi-share: when a `?factory=k1,k2,…` link opens with more
// than one key, the gameData layer resolves each key and hands the results here so
// the recipient can pick which to import. Resolved (ok:true) rows are pre-checked;
// unresolvable (ok:false — 404 / expired / over the cap) rows are greyed and
// unselectable. Selection is capped at MAX_SHARE_FACTORIES. This is a pure
// presentational picker: the gameData layer owns fetching and the actual import.
import React, { useEffect } from 'react';
import { Modal, Stack, Group, Button } from '@mantine/core';
import { FactoryOptions } from '../../contexts/production/types';
import { MAX_SHARE_FACTORIES, OVER_CAP_REASON } from '../../utilities/shared-factory/share-url';
import { FactorySelectList, SelectRow } from './PlannerOptions/FactorySelectList';
import { useRowSelection } from './PlannerOptions/useRowSelection';

// Resolved rows carry the fully-hydrated config so the gameData layer hydrates each
// incoming factory exactly once (at resolve time) and the import is a plain map.
// Unresolvable rows carry the reason they can't be imported (expired/invalid vs. past
// the cap) so the picker shows the accurate message.
export type IncomingFactory =
  | { key: string; ok: true; config: FactoryOptions; version: string; label: string }
  | { key: string; ok: false; reason: string };

export function ImportPickerModal({
  opened,
  incoming,
  onCancel,
  onImport,
}: {
  opened: boolean;
  incoming: IncomingFactory[];
  onCancel: () => void;
  onImport: (chosen: IncomingFactory[]) => void; // only ok:true rows
}) {
  const { selected, setSelected, toggle } = useRowSelection();

  // Default-check every resolved row, up to the cap, each time the picker opens.
  useEffect(() => {
    if (!opened) return;
    const ok = incoming.filter((i) => i.ok).slice(0, MAX_SHARE_FACTORIES);
    setSelected(new Set(ok.map((i) => i.key)));
  }, [opened, incoming, setSelected]);

  const atCap = selected.size >= MAX_SHARE_FACTORIES;

  const rows: SelectRow[] = incoming.map((i) => {
    if (!i.ok) {
      return { id: i.key, label: i.key, meta: '', disabled: true, disabledReason: i.reason };
    }
    const overCap = atCap && !selected.has(i.key);
    return {
      id: i.key,
      label: i.label,
      meta: `v${i.version}`,
      disabled: overCap,
      disabledReason: overCap ? OVER_CAP_REASON : undefined,
    };
  });

  const chosen = incoming.filter((i) => i.ok && selected.has(i.key));

  return (
    <Modal opened={opened} onClose={onCancel} title="Import shared factories" size="lg" centered>
      <Stack gap="sm">
        <FactorySelectList rows={rows} selected={selected} onToggle={toggle} />

        <Group justify="flex-end">
          <Button variant="default" styles={{ root: { color: 'var(--mantine-color-text)' } }} onClick={onCancel}>Cancel</Button>
          <Button
            color="positive.8"
            disabled={chosen.length === 0}
            onClick={() => onImport(chosen)}
          >
            Import {chosen.length ? `${chosen.length} selected` : 'selected'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
