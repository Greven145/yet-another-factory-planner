import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import ExperimentalModal from './ExperimentalModal';
import { theme } from '../../../theme';
import { ExperimentalProvider } from '../../../contexts/experimental';
import { EXPERIMENTAL_FLAGS } from '../../../contexts/experimental/consts';

function renderModal(onClose = vi.fn()) {
  const utils = render(
    <MantineProvider theme={theme}>
      <ExperimentalProvider>
        <ExperimentalModal opened onClose={onClose} />
      </ExperimentalProvider>
    </MantineProvider>
  );
  return { ...utils, onClose };
}

describe('ExperimentalModal', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders one switch per manifest flag, off by default', () => {
    renderModal();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(EXPERIMENTAL_FLAGS.length);
    switches.forEach((s) => expect(s).not.toBeChecked());
    // The single current flag is "Balancer view".
    expect(screen.getByRole('switch', { name: /Balancer view/ })).toBeInTheDocument();
  });

  it('persists an enabled flag across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderModal();

    const toggle = screen.getByRole('switch', { name: /Balancer view/ });
    await user.click(toggle);
    expect(toggle).toBeChecked();

    // A fresh render reads the persisted state back as enabled.
    unmount();
    renderModal();
    expect(screen.getByRole('switch', { name: /Balancer view/ })).toBeChecked();
  });
});
