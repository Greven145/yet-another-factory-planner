// The checkbox row list shared by every factory-picker modal: the library manager
// (export/import), the share-multiple picker, and the import picker. Each modal maps
// its own domain objects into `SelectRow`s; this component only knows how to render a
// scrollable, selectable list. Extracted from LibraryManagerModal, whose visible
// rows (label + active badge + version/time meta) it reproduces exactly.
import React from 'react';
import { Stack, Group, Checkbox, Text, Badge, Button } from '@mantine/core';

export type SelectRow = {
  id: string;
  label: string; // labelOf(factory, gameData)
  meta: string; // e.g. "v1.2 · 3m ago"
  isActive?: boolean; // renders the "active" badge
  disabled?: boolean;
  disabledReason?: string; // shown inline when disabled (e.g. "No products to share")
};

export function FactorySelectList({
  rows,
  selected,
  onToggle,
  onSelectAll,
  maxHeight = 260,
}: {
  rows: SelectRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  maxHeight?: number;
}) {
  return (
    <>
      {onSelectAll && (
        <Group justify="flex-end">
          <Button
            size="xs"
            variant="default"
            styles={{ root: { color: 'var(--mantine-color-text)' } }}
            onClick={onSelectAll}
          >
            Select all
          </Button>
        </Group>
      )}

      <Stack gap={4} style={{ maxHeight, overflow: 'auto' }}>
        {rows.map((row) => (
          <Group
            key={row.id}
            justify="space-between"
            wrap="nowrap"
            style={{
              padding: '4px 6px',
              borderRadius: 4,
              background: row.isActive ? 'var(--mantine-color-default-hover)' : undefined,
              opacity: row.disabled ? 0.55 : undefined,
            }}
          >
            <Checkbox
              checked={selected.has(row.id)}
              disabled={row.disabled}
              onChange={() => onToggle(row.id)}
              label={
                <span>
                  {row.label} {row.isActive && <Badge size="xs" variant="light">active</Badge>}
                  {row.disabled && row.disabledReason && (
                    <Text span size="xs" c="dimmed"> — {row.disabledReason}</Text>
                  )}
                </span>
              }
            />
            {row.meta && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{row.meta}</Text>
            )}
          </Group>
        ))}
      </Stack>
    </>
  );
}
