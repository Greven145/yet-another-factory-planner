// The factory bottom sheet: a bottom-anchored Drawer wrapping the existing
// FactorySwitcher so switching/creating/renaming factories on mobile reuses the
// exact desktop control (presentation only — no library logic changes).
import React from 'react';
import { Drawer, Text } from '@mantine/core';
import FactorySwitcher from '../PlannerOptions/FactorySwitcher';

type Props = {
  opened: boolean;
  onClose: () => void;
};

const FactorySheet = ({ opened, onClose }: Props) => (
  <Drawer
    opened={opened}
    onClose={onClose}
    position="bottom"
    size="60%"
    title={<Text fw={700}>Factories</Text>}
  >
    <FactorySwitcher layout="stacked" />
  </Drawer>
);

export default FactorySheet;
