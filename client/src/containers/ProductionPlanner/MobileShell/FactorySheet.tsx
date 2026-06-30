// The factory bottom sheet: a bottom-anchored Drawer wrapping the mobile factory
// picker — a search-first list of factories. Tapping one switches to it and closes
// the sheet (see FactoryPicker).
//
// Dressed to match the app's Rename/Delete modals (see the Modal theme in theme.ts):
// the same steel surface, an underlined header, and the FICSIT-orange accent stripe —
// placed on the TOP edge here since the sheet rises from the bottom — instead of the
// plain default Drawer chrome.
import React from 'react';
import { Drawer } from '@mantine/core';
import FactoryPicker from './FactoryPicker';

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
    radius={0}
    title="Factories"
    closeButtonProps={{ 'aria-label': 'Close' }}
    styles={{
      content: {
        background: 'light-dark(#ffffff, #373b40)',
        borderTop: '4px solid var(--mantine-color-primary-6)',
      },
      header: {
        background: 'light-dark(#ffffff, #373b40)',
        borderBottom: '1px solid light-dark(#dee2e6, #50565e)',
        paddingBottom: '12px',
      },
      title: { fontWeight: 700, fontSize: '18px', color: 'light-dark(#212529, #eee)' },
      body: { paddingTop: '16px', color: 'light-dark(#212529, #eee)' },
      close: { color: 'light-dark(#212529, #eee)' },
    }}
  >
    <FactoryPicker onClose={onClose} />
  </Drawer>
);

export default FactorySheet;
