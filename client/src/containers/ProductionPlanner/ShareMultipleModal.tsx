// Share several library factories in ONE link. Opened from the Share split-button
// dropdown (see ShareButton). Operates over the whole library, not the active
// factory: rows list every saved factory, un-shareable ones are disabled, and the
// selection is capped at MAX_SHARE_FACTORIES. Posting each factory + copying the
// combined link is owned by useShareFactories (which reuses the #182 clipboard
// discipline); this modal is the selection UI + feedback around it.
import React, { useEffect } from 'react';
import { Modal, Stack, Button, Text, Alert } from '@mantine/core';
import { useLibraryContext } from '../../contexts/library';
import { GameData } from '../../contexts/gameData/types';
import { labelOf, relativeTime } from '../../utilities/factory-label';
import { canShareFactory } from '../../utilities/shared-factory/codec';
import { MAX_SHARE_FACTORIES, OVER_CAP_REASON } from '../../utilities/shared-factory/share-url';
import { FactorySelectList, SelectRow } from './PlannerOptions/FactorySelectList';
import { useRowSelection } from './PlannerOptions/useRowSelection';
import { useShareFactories } from './useShareFactories';
import { ManualCopyField } from './ShareStatusView';

export const ShareMultipleModal = ({
  opened,
  onClose,
  gameData,
}: {
  opened: boolean;
  onClose: () => void;
  gameData: GameData;
}) => {
  const lib = useLibraryContext();
  const share = useShareFactories();
  const { selected, setSelected, toggle } = useRowSelection();

  // Reset the selection each time the modal opens.
  useEffect(() => {
    if (opened) setSelected(new Set());
  }, [opened, setSelected]);

  const atCap = selected.size >= MAX_SHARE_FACTORIES;

  const rows: SelectRow[] = lib.factories.map((f) => {
    const shareable = !!f.config && canShareFactory(f.config);
    const overCap = atCap && !selected.has(f.id);
    let disabledReason: string | undefined;
    if (!shareable) disabledReason = 'No products to share';
    else if (overCap) disabledReason = OVER_CAP_REASON;
    return {
      id: f.id,
      label: labelOf(f, gameData),
      meta: `v${f.gameVersion} · ${relativeTime(f.updatedAt)}`,
      isActive: f.id === lib.activeId,
      disabled: !shareable || overCap,
      disabledReason,
    };
  });

  // Only shareable factories can end up selected (disabled rows can't be toggled on),
  // so `chosen` is safe to POST directly.
  const chosen = lib.factories.filter((f) => selected.has(f.id));

  // Select all shareable factories, up to the cap.
  const selectAll = () => {
    const ids = lib.factories
      .filter((f) => !!f.config && canShareFactory(f.config))
      .slice(0, MAX_SHARE_FACTORIES)
      .map((f) => f.id);
    setSelected(new Set(ids));
  };

  const busy = share.status === 'copying';

  return (
    <Modal opened={opened} onClose={onClose} title="Share factories" size="lg" centered>
      <Stack gap="sm">
        <FactorySelectList rows={rows} selected={selected} onToggle={toggle} onSelectAll={selectAll} />

        {atCap && (
          <Text size="xs" c="dimmed">You can share up to {MAX_SHARE_FACTORIES} factories in one link.</Text>
        )}

        <Button
          color="positive.8"
          disabled={chosen.length === 0 || busy}
          loading={busy}
          onClick={() => share.onShare(chosen)}
        >
          Share {chosen.length ? `${chosen.length} selected` : 'selected'}
        </Button>

        {share.status === 'failed' && (
          <Alert color="red" title="Couldn't copy — copy the link below">
            <ManualCopyField link={share.link} />
          </Alert>
        )}
        {share.status === 'copied' && (
          <Text size="sm" c="green">
            {share.sharedCount < share.totalCount
              ? `Shared ${share.sharedCount} of ${share.totalCount} — copied`
              : 'Link copied!'}
          </Text>
        )}
        {share.status === 'copying' && <Text size="sm">Generating…</Text>}
      </Stack>
    </Modal>
  );
};
