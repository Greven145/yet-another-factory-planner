// The Experimental features dialog: one Switch per manifest flag, backed by the
// experimental-flags context (persisted to localStorage). Presentational — the
// caller owns open/close. Dressed by the global Modal theme (see theme.ts).
//
// react-feather has no flask/beaker and free-solid-svg-icons isn't a dependency
// (only free-brands is), so the flask is an inline SVG in react-feather's stroke
// style — the same approach SiteHeader already uses for its Sun/Moon icons.
import React from 'react';
import { Modal, Switch, Stack, Text, Group } from '@mantine/core';
import { useExperimentalContext } from '../../../contexts/experimental';

export const FlaskIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 3h6" />
    <path d="M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" />
    <path d="M7 15h10" />
  </svg>
);

type Props = {
  opened: boolean;
  onClose: () => void;
};

const ExperimentalModal = ({ opened, onClose }: Props) => {
  const { flags, isEnabled, setEnabled } = useExperimentalContext();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Group gap="xs"><FlaskIcon /> Experimental features</Group>}
    >
      <Text size="sm" c="dimmed" mb="md">
        These features are unfinished and may change or break.
      </Text>
      <Stack gap="md">
        {flags.map((flag) => (
          <Switch
            key={flag.key}
            label={flag.label}
            description={flag.description}
            checked={isEnabled(flag.key)}
            onChange={(e) => setEnabled(flag.key, e.currentTarget.checked)}
          />
        ))}
      </Stack>
    </Modal>
  );
};

export default ExperimentalModal;
