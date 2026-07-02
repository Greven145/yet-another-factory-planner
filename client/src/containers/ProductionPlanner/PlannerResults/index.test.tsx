import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, DefaultTheme } from 'styled-components';
import { theme } from '../../../theme';
import { ExperimentalProvider } from '../../../contexts/experimental';
import { EXPERIMENTAL_FLAGS_STORAGE_KEY } from '../../../contexts/experimental/consts';

// Card reads theme.colors.primary[6] from the styled-components theme for its
// left border; provide the minimal shape it expects.
const scTheme = {
  colors: {
    background: ['#26282b', '#373b40', '#3f434a', '#50565e', '#6c7582'],
    primary: ['#fcebde', '#f9d8be', '#f7c59f', '#f4b17f', '#f19e60', '#ef8b40', '#ec7821'],
  },
} as unknown as DefaultTheme;

// The real tabs pull in the solver, react-flow, and the production context. None
// of that is relevant to gating, so stub them out with trivial components that
// echo their props via data attributes.
vi.mock('./ProductionGraphTab', () => ({
  default: ({ dedicatedLines, showTransport }: { dedicatedLines: boolean; showTransport: boolean }) => (
    <div data-testid="graph-tab" data-dedicated={String(dedicatedLines)} data-transport={String(showTransport)} />
  ),
}));
vi.mock('./FlowTab', () => ({
  default: ({ dedicatedLines, showTransport }: { dedicatedLines: boolean; showTransport: boolean }) => (
    <div data-testid="flow-tab" data-dedicated={String(dedicatedLines)} data-transport={String(showTransport)} />
  ),
}));
vi.mock('./ReportTab', () => ({
  default: () => <div data-testid="report-tab" />,
}));

import PlannerResults from './index';

function renderResults() {
  return render(
    <MantineProvider theme={theme}>
      <ThemeProvider theme={scTheme}>
        <ExperimentalProvider>
          <PlannerResults />
        </ExperimentalProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}

describe('PlannerResults balancer gating', () => {
  beforeEach(() => window.localStorage.clear());

  it('hides the balancer switches when the flag is off (default)', async () => {
    renderResults();
    // Lazy tabs resolve asynchronously; wait for the mounted graph tab.
    expect(await screen.findByTestId('graph-tab')).toBeInTheDocument();
    expect(screen.queryByText('Dedicated lines')).toBeNull();
    expect(screen.queryByText('Belt/pipe needs')).toBeNull();
    expect(screen.queryByLabelText('Dedicated lines')).toBeNull();
    expect(screen.queryByLabelText('Belt/pipe needs')).toBeNull();
  });

  it('forces the tab effect off when the flag is off', async () => {
    renderResults();
    const graph = await screen.findByTestId('graph-tab');
    expect(graph).toHaveAttribute('data-dedicated', 'false');
    expect(graph).toHaveAttribute('data-transport', 'false');
  });

  it('shows the balancer switches when the flag is on', async () => {
    window.localStorage.setItem(
      EXPERIMENTAL_FLAGS_STORAGE_KEY,
      JSON.stringify({ 'balancer-view': true }),
    );
    renderResults();
    expect(await screen.findByTestId('graph-tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Dedicated lines')).toBeInTheDocument();
    expect(screen.getByLabelText('Belt/pipe needs')).toBeInTheDocument();
  });

  it('passes toggled switch state through to the tabs', async () => {
    window.localStorage.setItem(
      EXPERIMENTAL_FLAGS_STORAGE_KEY,
      JSON.stringify({ 'balancer-view': true }),
    );
    const user = userEvent.setup();
    renderResults();
    const graph = await screen.findByTestId('graph-tab');
    expect(graph).toHaveAttribute('data-dedicated', 'false');

    await user.click(screen.getByLabelText('Dedicated lines'));
    expect(screen.getByTestId('graph-tab')).toHaveAttribute('data-dedicated', 'true');

    await user.click(screen.getByLabelText('Belt/pipe needs'));
    expect(screen.getByTestId('graph-tab')).toHaveAttribute('data-transport', 'true');
  });
});
