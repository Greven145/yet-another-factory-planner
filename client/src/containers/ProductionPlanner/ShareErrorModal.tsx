import React, { useEffect, useState } from 'react';
import { Modal, Button, Text, Group } from '@mantine/core';
import { useGameDataContext } from '../../contexts/gameData';

// Shown when a ?factory= share link can't be resolved (invalid or past its
// 7-day TTL). Deliberately escapable — "Continue" drops the user straight into
// the normal factory that loaded behind it, instead of the old full-screen
// dead-end. gameData already fell through to a normal load; this is purely the
// explanation.
export default function ShareErrorModal() {
  const { shareError, clearShareError } = useGameDataContext();
  // Local latch so dismissing closes the modal without racing context state; a
  // fresh failure re-opens it (shareError goes false→true between loads).
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (shareError) setDismissed(false); }, [shareError]);

  const close = () => { setDismissed(true); clearShareError(); };

  return (
    <Modal
      opened={shareError && !dismissed}
      onClose={close}
      centered
      withCloseButton={false}
      title="Shared factory not found"
    >
      <Text size="sm" mb="lg">
        That share link is invalid or has expired, so there&apos;s nothing to load.
        Share links are only valid for <strong>7 days</strong> — after that they
        expire automatically. We&apos;ve dropped you into a fresh factory instead.
      </Text>
      <Group justify="flex-end" gap={8}>
        <Button onClick={close}>Continue</Button>
      </Group>
    </Modal>
  );
}
