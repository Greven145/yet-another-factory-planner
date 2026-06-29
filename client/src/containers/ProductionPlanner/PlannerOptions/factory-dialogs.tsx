import React, { useEffect, useState } from 'react';
import { Modal, TextInput, Button, Group, Text } from '@mantine/core';

export const RenameDialog = ({
  opened,
  initial,
  onClose,
  onSubmit,
}: {
  opened: boolean;
  initial: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) => {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (opened) setValue(initial); }, [opened, initial]);
  return (
    <Modal opened={opened} onClose={onClose} title="Rename factory">
      <TextInput
        data-autofocus
        label="Nickname"
        placeholder="e.g. Main bus — rotors"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onSubmit(value); onClose(); } }}
      />
      <Text size="xs" c="dimmed" mt={6}>Leave empty to fall back to the auto-label.</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" styles={{ root: { color: 'var(--mantine-color-text)' } }} onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onSubmit(value); onClose(); }}>Save</Button>
      </Group>
    </Modal>
  );
};

export const DeleteDialog = ({
  opened,
  label,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Modal opened={opened} onClose={onClose} title="Delete factory">
    <Text>Delete <strong>{label}</strong>? This can't be undone.</Text>
    <Group justify="flex-end" mt="md">
      <Button variant="default" styles={{ root: { color: 'var(--mantine-color-text)' } }} onClick={onClose}>Cancel</Button>
      <Button color="danger.8" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
    </Group>
  </Modal>
);
