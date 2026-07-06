// The Share control, shared by the desktop FactorySwitcher header band and the mobile
// FactoryPicker sheet. The two rendered identical Tooltip + Popover + Button + feedback;
// only the popover anchor and the wrapper alignment differ, so those are props. The copy
// behavior and feedback lifecycle live in useShareFactory (see #182).
import React from 'react';
import { Tooltip, Button, Popover } from '@mantine/core';
import { Share2 } from 'react-feather';
import { useProductionContext } from '../../contexts/production';
import { canShareFactory } from '../../utilities/shared-factory/codec';
import { useShareFactory } from './useShareFactory';
import ShareStatusView from './ShareStatusView';

type Props = {
  // Popover anchor: the desktop header band opens downward, the mobile sheet upward.
  position?: 'bottom-end' | 'top-end';
  // Optional style for the wrapping span (the mobile row pushes the button to the end).
  wrapperStyle?: React.CSSProperties;
};

const ShareButton = ({ position = 'bottom-end', wrapperStyle }: Props) => {
  const ctx = useProductionContext();
  const share = useShareFactory();

  // Guard the Share button rather than firing a POST that 400s with no feedback.
  const canShare = canShareFactory(ctx.state);

  return (
    <Tooltip label="Add a product to share this factory" withArrow disabled={canShare}>
      {/* The span keeps the Tooltip alive while the Button is disabled (a disabled
          control emits no pointer events). The Popover targets the Button — not the
          span — so its aria-haspopup/aria-expanded land on an element that supports
          them (WCAG aria-allowed-attr). */}
      <span style={wrapperStyle}>
        <Popover opened={share.status !== 'idle' && canShare} position={position} withArrow>
          <Popover.Target>
            <Button color="positive.8" leftSection={<Share2 size={16} />} loading={ctx.shareLink.loading} disabled={!canShare} onClick={share.onShare}>Share</Button>
          </Popover.Target>
          <Popover.Dropdown><ShareStatusView status={share.status} link={share.link} /></Popover.Dropdown>
        </Popover>
      </span>
    </Tooltip>
  );
};

export default ShareButton;
