import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { theme } from '../../../theme';

// Stub the heavy children so the shell can be tested in isolation: the real
// ConfigSections/PlannerResults pull in the full planner option tabs + the
// cytoscape/GLPK results view, which need the production context and are covered
// by their own suites. MobileTopBar is stubbed to a button that triggers the
// factory-sheet callback, and FactorySheet to a presence marker.
vi.mock('./ConfigSections', () => ({ default: () => <div data-testid="config-sections" /> }));
vi.mock('../PlannerResults', () => ({ default: () => <div data-testid="planner-results" /> }));
vi.mock('./MobileTopBar', () => ({
  default: ({ onOpenFactories }: { onOpenFactories: () => void }) => (
    <button type="button" onClick={onOpenFactories}>open-factories</button>
  ),
}));
vi.mock('./FactorySheet', () => ({
  default: ({ opened }: { opened: boolean }) => (opened ? <div data-testid="factory-sheet" /> : null),
}));

import MobileShell from './index';

function renderShell() {
  return render(
    <MantineProvider theme={theme}>
      <MobileShell />
    </MantineProvider>
  );
}

describe('MobileShell', () => {
  it('starts in Configure mode showing the config sections', () => {
    renderShell();
    expect(screen.getByTestId('config-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-results')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches between Configure and Results via the bottom nav', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Results' }));
    expect(screen.getByTestId('planner-results')).toBeInTheDocument();
    expect(screen.queryByTestId('config-sections')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Results' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByTestId('config-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-results')).not.toBeInTheDocument();
  });

  it('opens the factory sheet from the top bar', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.queryByTestId('factory-sheet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'open-factories' }));
    expect(screen.getByTestId('factory-sheet')).toBeInTheDocument();
  });
});
