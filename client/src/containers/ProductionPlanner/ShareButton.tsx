// The Share control, shared by the desktop FactorySwitcher header band and the mobile
// FactoryPicker sheet. It is a split button: the main Share button posts + copies the
// ACTIVE factory (unchanged single-share behavior, gated by canShareFactory), and a
// narrow chevron opens a menu with "Share multiple…" — which shares a picked set of
// LIBRARY factories in one link (see ShareMultipleModal). The chevron is always
// enabled; only the main button is gated. Copy behavior/feedback live in
// useShareFactory (single) / useShareFactories (multi) — see #182.
import React, { useState } from 'react';
import { Tooltip, Button, Popover, Menu } from '@mantine/core';
import { Share2, ChevronDown } from 'react-feather';
import { useProductionContext } from '../../contexts/production';
import { canShareFactory } from '../../utilities/shared-factory/codec';
import { useShareFactory } from './useShareFactory';
import ShareStatusView from './ShareStatusView';
import { ShareMultipleModal } from './ShareMultipleModal';

type Props = {
  // Popover/menu anchor: the desktop header band opens downward, the mobile sheet upward.
  position?: 'bottom-end' | 'top-end';
  // Optional style for the wrapping group (the mobile row pushes the button to the end).
  wrapperStyle?: React.CSSProperties;
};

const ShareButton = ({ position = 'bottom-end', wrapperStyle }: Props) => {
  const ctx = useProductionContext();
  const share = useShareFactory();
  const [multiOpen, setMultiOpen] = useState(false);

  // Guard the main Share button rather than firing a POST that 400s with no feedback.
  const canShare = canShareFactory(ctx.state);

  return (
    <>
      <Button.Group style={wrapperStyle}>
        <Tooltip label="Add a product to share this factory" withArrow disabled={canShare}>
          {/* The span keeps the Tooltip alive while the Button is disabled (a disabled
              control emits no pointer events). The Popover targets the Button — not the
              span — so its aria-haspopup/aria-expanded land on an element that supports
              them (WCAG aria-allowed-attr). */}
          <span>
            <Popover opened={share.status !== 'idle' && canShare} position={position} withArrow>
              <Popover.Target>
                <Button color="positive.8" leftSection={<Share2 size={16} />} loading={ctx.shareLink.loading} disabled={!canShare} onClick={share.onShare}>Share</Button>
              </Popover.Target>
              <Popover.Dropdown><ShareStatusView status={share.status} link={share.link} /></Popover.Dropdown>
            </Popover>
          </span>
        </Tooltip>
        <Menu position={position} withArrow shadow="md">
          <Menu.Target>
            <Button color="positive.8" aria-label="More share options" px={8}><ChevronDown size={16} /></Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setMultiOpen(true)}>Share multiple…</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Button.Group>

      <ShareMultipleModal opened={multiOpen} onClose={() => setMultiOpen(false)} gameData={ctx.gameData} />
    </>
  );
};

export default ShareButton;
