import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import BottomNav from './BottomNav';
import { theme } from '../../../theme';

function renderNav(mode: 'configure' | 'results', onChange = vi.fn()) {
  const utils = render(
    <MantineProvider theme={theme}>
      <BottomNav mode={mode} onChange={onChange} />
    </MantineProvider>
  );
  return { ...utils, onChange };
}

describe('BottomNav', () => {
  it('renders Configure and Results as a labelled nav', () => {
    renderNav('configure');
    expect(screen.getByRole('navigation', { name: 'Mobile views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Results' })).toBeInTheDocument();
  });

  it('marks only the active mode with aria-current', () => {
    renderNav('results');
    expect(screen.getByRole('button', { name: 'Results' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Configure' })).not.toHaveAttribute('aria-current');
  });

  it('fires onChange with the tapped mode', async () => {
    const user = userEvent.setup();
    const { onChange } = renderNav('configure');
    await user.click(screen.getByRole('button', { name: 'Results' }));
    expect(onChange).toHaveBeenCalledWith('results');
  });
});
