// Shared Share-popover content, so the desktop FactorySwitcher and the mobile
// FactoryPicker render identical feedback off the same useShareFactory status. The
// popovers themselves differ (position/anchor) and stay in each component; only this
// inner message + manual-copy fallback is shared.
import React, { useEffect, useRef } from 'react';
import { Text, TextInput } from '@mantine/core';
import type { ShareStatus } from './useShareFactory';

// A read-only, auto-selected field holding the link, shown when the clipboard write
// couldn't complete (rejected, or an insecure/unsupported context). It guarantees the
// link is always reachable — one Ctrl/Cmd-C away — even when the server was cold.
const ManualCopyField = ({ link }: { link: string }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <TextInput
      ref={ref}
      value={link}
      readOnly
      onFocus={(e) => e.currentTarget.select()}
      aria-label="Shareable link"
      size="xs"
    />
  );
};

const ShareStatusView = ({ status, link }: { status: ShareStatus; link: string }) => {
  if (status === 'failed') {
    return (
      <div style={{ maxWidth: 260 }}>
        <Text size="sm" mb={6}>Couldn't copy — copy the link below</Text>
        <ManualCopyField link={link} />
      </div>
    );
  }
  // 'copying' (and the closed 'idle') show progress; 'copied' confirms the write.
  return <Text size="sm">{status === 'copied' ? 'Link copied!' : 'Generating…'}</Text>;
};

export default ShareStatusView;
