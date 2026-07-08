// The factory switcher, rendered in the MAIN content column (between the graph and
// the PlannerResults view tabs). Tabs reuse the app's `segmented-tabs` look (steel
// track, FICSIT-orange active segment, monospace uppercase) so it reads as a native
// control, presented as a header band with a divider above the view tabs. Switching
// = the tabs; per-factory actions sit in a "⋯" menu + Share beside.
import React, { useState } from 'react';
import { Tabs, Group, Menu, ActionIcon, Tooltip } from '@mantine/core';
import { Plus, MoreHorizontal, Edit2, Copy, Trash2, RotateCcw, Folder } from 'react-feather';
import { useProductionContext } from '../../../contexts/production';
import { useLibraryContext } from '../../../contexts/library';
import { labelOf, relativeTime } from '../../../utilities/factory-label';
import ShareButton from '../ShareButton';
import { RenameDialog, DeleteDialog } from './factory-dialogs';
import { LibraryManagerModal } from './LibraryManagerModal';

// `inline` (default) is the desktop header band: tabs and actions share one nowrap
// row. `stacked` is for the narrow mobile factory sheet, where that single row makes
// the tabs overlap the +/⋯/Share cluster — so the tabs get their own full-width
// scrollable row and the actions drop to a second row beneath.
type FactorySwitcherLayout = 'inline' | 'stacked';

const FactorySwitcher = ({ layout = 'inline' }: { layout?: FactorySwitcherLayout }) => {
  const ctx = useProductionContext();
  const lib = useLibraryContext();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const activeFactory = lib.activeFactory;
  if (!activeFactory) return null;

  // Label every tab (including the active one) from its stored config. Autosave keeps
  // the active factory's config in sync with live edits, so this stays current while
  // editing AND shows the correct label the instant you switch tabs — deriving the
  // active label from the reducer state instead lags a render behind the switch and
  // flashes the previous factory's name.
  const activeLabel = labelOf(activeFactory, ctx.gameData);

  const stacked = layout === 'stacked';

  // Factory switcher — native segmented-tabs look, horizontally scrollable. In the
  // inline layout it flexes to share the row with the actions; stacked, it spans its
  // own full-width row above them.
  const tabsNode = (
    <div style={{ flex: stacked ? undefined : 1, width: stacked ? '100%' : undefined, minWidth: 0, overflowX: 'auto' }}>
      <Tabs
        value={lib.activeId}
        onChange={(v) => v && lib.select(v)}
        variant="pills"
        className="segmented-tabs"
      >
        {/* Drop the track's built-in bottom margin; the band padding controls
            spacing now so the controls align to the tab track. */}
        <Tabs.List style={{ flexWrap: 'nowrap', marginBottom: 0 }}>
          {lib.factories.map((f) => {
            const label = labelOf(f, ctx.gameData);
            return (
              <Tabs.Tab key={f.id} value={f.id} title={`${label} · edited ${relativeTime(f.updatedAt)}`}>
                <span style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                  {label}
                </span>
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
        {/* The switched content (graph/report) lives below in PlannerResults, not
            in tab panels — this Tabs is used purely as a factory selector. Mantine
            still emits aria-controls on every tab, so render an empty, hidden panel
            per factory (keepMounted, so inactive tabs resolve too) to keep those
            references valid (WCAG aria-valid-attr-value). */}
        {lib.factories.map((f) => (
          <Tabs.Panel key={f.id} value={f.id} keepMounted style={{ display: 'none' }}>
            <></>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );

  const actionsNode = (
    <>
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
          <Menu.Divider />
          <Menu.Item leftSection={<Folder size={14} />} onClick={() => setManageOpen(true)}>Manage library…</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Share */}
      <ShareButton position="bottom-end" />
    </>
  );

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
      {stacked ? (
        <>
          {tabsNode}
          {/* Actions on their own row so they can never overlap the tabs in the
              narrow factory sheet. */}
          <Group gap="xs" wrap="nowrap" align="center" justify="flex-end" mt="sm">
            {actionsNode}
          </Group>
        </>
      ) : (
        <Group gap="xs" wrap="nowrap" align="center">
          {tabsNode}
          {actionsNode}
        </Group>
      )}

      <RenameDialog opened={renameOpen} initial={activeFactory.nickname ?? ''} onClose={() => setRenameOpen(false)} onSubmit={(v) => lib.rename(lib.activeId, v)} />
      <DeleteDialog opened={deleteOpen} label={activeLabel} onClose={() => setDeleteOpen(false)} onConfirm={() => lib.remove(lib.activeId)} />
      <LibraryManagerModal opened={manageOpen} onClose={() => setManageOpen(false)} gameData={ctx.gameData} />
    </div>
  );
};

export default FactorySwitcher;
