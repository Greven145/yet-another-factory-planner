// The mobile factory picker: a search-first vertical list of saved factories, shown
// inside the factory bottom sheet (FactorySheet). It replaces the horizontal tab
// strip the sheet used to borrow from the desktop FactorySwitcher — on a phone those
// tabs overflow and scroll sideways, so a filterable list reads far better.
//
// Tapping a factory switches to it AND dismisses the sheet (picking one is the whole
// reason the sheet is open). The per-row "⋮" handles rename/duplicate/delete, plus
// "Reset to empty" on the active row (it acts on the live reducer state). New + Share
// sit in the footer; Share targets the active factory, as on desktop.
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Menu, ActionIcon, Button, Group, Text, TextInput } from '@mantine/core';
import { Search, Plus, Check, MoreVertical, Edit2, Copy, Trash2, RotateCcw } from 'react-feather';
import { useProductionContext } from '../../../contexts/production';
import { useLibraryContext } from '../../../contexts/library';
import { labelOf, relativeTime } from '../../../utilities/factory-label';
import ShareButton from '../ShareButton';
import { RenameDialog, DeleteDialog } from '../PlannerOptions/factory-dialogs';

type Props = { onClose: () => void };

const FactoryPicker = ({ onClose }: Props) => {
  const ctx = useProductionContext();
  const lib = useLibraryContext();
  const [query, setQuery] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const byId = (id: string | null) => (id ? lib.factories.find((f) => f.id === id) : undefined);

  const filtered = useMemo(
    () => lib.factories.filter((f) => labelOf(f, ctx.gameData).toLowerCase().includes(query.trim().toLowerCase())),
    [lib.factories, ctx.gameData, query],
  );

  const pick = (id: string) => { lib.select(id); onClose(); };

  return (
    <>
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search factories…"
        aria-label="Search factories"
        leftSection={<Search size={16} />}
        mb="sm"
      />

      <List className="custom-scrollbar">
        {filtered.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">No matching factories</Text>
        ) : (
          filtered.map((f) => {
            const isActive = f.id === lib.activeId;
            return (
              <Row key={f.id} $active={isActive}>
                <RowSelect type="button" onClick={() => pick(f.id)} aria-current={isActive}>
                  <CheckSlot>{isActive && <Check size={16} />}</CheckSlot>
                  <RowText>
                    <Text size="sm" fw={isActive ? 600 : 400} truncate>{labelOf(f, ctx.gameData)}</Text>
                    <Text size="xs" c="dimmed">edited {relativeTime(f.updatedAt)}</Text>
                  </RowText>
                </RowSelect>
                <Menu position="bottom-end" withArrow shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="lg" aria-label={`Actions for ${labelOf(f, ctx.gameData)}`} styles={{ root: { color: 'var(--mantine-color-text)' } }}>
                      <MoreVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<Edit2 size={14} />} onClick={() => setRenameId(f.id)}>Rename</Menu.Item>
                    <Menu.Item leftSection={<Copy size={14} />} onClick={() => lib.duplicate(f.id)}>Duplicate</Menu.Item>
                    <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => setDeleteId(f.id)}>Delete</Menu.Item>
                    {isActive && (
                      <>
                        <Menu.Divider />
                        <Menu.Item leftSection={<RotateCcw size={14} />} onClick={() => ctx.dispatch({ type: 'RESET_FACTORY', gameData: ctx.gameData })}>Reset to empty</Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Row>
            );
          })
        )}
      </List>

      <Group gap="xs" mt="md" wrap="nowrap">
        <Button variant="default" leftSection={<Plus size={16} />} onClick={() => lib.create()} styles={{ root: { color: 'var(--mantine-color-text)' } }}>
          New factory
        </Button>
        <ShareButton position="top-end" wrapperStyle={{ marginLeft: 'auto' }} />
      </Group>

      <RenameDialog opened={!!renameId} initial={byId(renameId)?.nickname ?? ''} onClose={() => setRenameId(null)} onSubmit={(v) => renameId && lib.rename(renameId, v)} />
      <DeleteDialog opened={!!deleteId} label={byId(deleteId) ? labelOf(byId(deleteId)!, ctx.gameData) : ''} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && lib.remove(deleteId)} />
    </>
  );
};

export default FactoryPicker;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  /* Cap the list so the New/Share footer stays in view inside the 60%-tall sheet. */
  max-height: 45vh;
  /* Breathing room so the cards' accent + focus ring aren't clipped while scrolling. */
  padding: 2px;
`;

// Each factory is its own card — steel surface, squared corners, and (when active)
// the FICSIT-orange left accent the app's Card/Modal use. Inactive cards keep a
// transparent 5px left edge so switching active doesn't shift the text.
const Row = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  border: 1px solid var(--yafp-graph-border);
  border-left: 5px solid ${({ $active }) => ($active ? 'var(--mantine-color-primary-6)' : 'transparent')};
  border-radius: 4px;
  background: ${({ $active }) => ($active ? 'light-dark(#ffffff, #474c54)' : 'light-dark(#e9ecef, #3f434a)')};
  transition: background 0.12s ease;

  &:hover {
    background: light-dark(#ffffff, #474c54);
  }
`;

const RowSelect = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  text-align: left;
  padding: 12px;
  cursor: pointer;
  color: inherit;
`;

const CheckSlot = styled.span`
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  color: var(--mantine-color-primary-6);
`;

const RowText = styled.span`
  min-width: 0;
  flex: 1;
`;
