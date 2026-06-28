// The factory switcher, rendered in the MAIN content column (between the graph and
// the PlannerResults view tabs). Tabs reuse the app's `segmented-tabs` look (steel
// track, FICSIT-orange active segment, monospace uppercase) so it reads as a native
// control, presented as a header band with a divider above the view tabs. Switching
// = the tabs; per-factory actions sit in a "⋯" menu + Share beside.
import React, { useState } from 'react';
import { Tabs, Group, Menu, Text, ActionIcon, Tooltip, Button, Popover } from '@mantine/core';
import { Plus, Share2, MoreHorizontal, Edit2, Copy, Trash2, RotateCcw } from 'react-feather';
import { useProductionContext } from '../../../contexts/production';
import { useLibraryContext } from '../../../contexts/library';
import { labelOf, relativeTime } from '../../../utilities/factory-label';
import { RenameDialog, DeleteDialog } from './factory-dialogs';

const FactorySwitcher = () => {
  const ctx = useProductionContext();
  const lib = useLibraryContext();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeFactory = lib.activeFactory;
  if (!activeFactory) return null;

  // Label every tab (including the active one) from its stored config. Autosave keeps
  // the active factory's config in sync with live edits, so this stays current while
  // editing AND shows the correct label the instant you switch tabs — deriving the
  // active label from the reducer state instead lags a render behind the switch and
  // flashes the previous factory's name.
  const labelFor = (id: string) => labelOf(lib.factories.find((f) => f.id === id)!, ctx.gameData);
  const activeLabel = labelOf(activeFactory, ctx.gameData);

  // The API only accepts factories with at least one selected product, so guard the
  // Share button rather than firing a POST that 400s with no feedback.
  const canShare = ctx.state.productionItems.some((i) => i.itemKey);
  const onShare = () => { ctx.generateShareLink(); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  return (
    // Present the switcher as a top "header band" — controls aligned to the tab
    // track, closed by a thin rule using the graph-area border token, so "which
    // factory" reads as a level above the graph/report view tabs below.
    <div
      style={{
        marginTop: 12,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--yafp-graph-border)',
      }}
    >
      <Group gap="xs" wrap="nowrap" align="center">
        {/* Factory switcher — native segmented-tabs look, horizontally scrollable */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <Tabs
            value={lib.activeId}
            onChange={(v) => v && lib.select(v)}
            variant="pills"
            className="segmented-tabs"
          >
            {/* Drop the track's built-in bottom margin; the band padding controls
                spacing now so the controls align to the tab track. */}
            <Tabs.List style={{ flexWrap: 'nowrap', marginBottom: 0 }}>
              {lib.factories.map((f) => (
                <Tabs.Tab key={f.id} value={f.id} title={`${labelFor(f.id)} · edited ${relativeTime(f.updatedAt)}`}>
                  <span style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                    {labelFor(f.id)}
                  </span>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </div>

        {/* New */}
        <Tooltip label="New factory" withArrow>
          <ActionIcon variant="default" size="lg" aria-label="New factory" onClick={() => lib.create()} styles={{ root: { color: 'var(--mantine-color-text)' } }}>
            <Plus size={18} />
          </ActionIcon>
        </Tooltip>

        {/* Active-factory actions */}
        <Menu position="bottom-end" withArrow shadow="md">
          <Menu.Target>
            <ActionIcon variant="default" size="lg" aria-label="Factory actions" styles={{ root: { color: 'var(--mantine-color-text)' } }}>
              <MoreHorizontal size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Edit2 size={14} />} onClick={() => setRenameOpen(true)}>Rename</Menu.Item>
            <Menu.Item leftSection={<Copy size={14} />} onClick={() => lib.duplicate(lib.activeId)}>Duplicate</Menu.Item>
            <Menu.Item leftSection={<Trash2 size={14} />} color="red" onClick={() => setDeleteOpen(true)}>Delete</Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<RotateCcw size={14} />} onClick={() => ctx.dispatch({ type: 'RESET_FACTORY', gameData: ctx.gameData })}>Reset to empty</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* Share */}
        <Tooltip label="Add a product to share this factory" withArrow disabled={canShare}>
          <Popover opened={copied && canShare} position="bottom-end" withArrow>
            <Popover.Target>
              {/* Span wrapper so the Tooltip still works while the Button is disabled. */}
              <span>
                <Button color="positive.8" leftSection={<Share2 size={16} />} loading={ctx.shareLink.loading} disabled={!canShare} onClick={onShare}>Share</Button>
              </span>
            </Popover.Target>
            <Popover.Dropdown><Text size="sm">{ctx.shareLink.link ? 'Link copied!' : 'Generating…'}</Text></Popover.Dropdown>
          </Popover>
        </Tooltip>
      </Group>

      <RenameDialog opened={renameOpen} initial={activeFactory.nickname ?? ''} onClose={() => setRenameOpen(false)} onSubmit={(v) => lib.rename(lib.activeId, v)} />
      <DeleteDialog opened={deleteOpen} label={activeLabel} onClose={() => setDeleteOpen(false)} onConfirm={() => lib.remove(lib.activeId)} />
    </div>
  );
};

export default FactorySwitcher;
