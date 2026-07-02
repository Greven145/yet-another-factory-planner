import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, DefaultTheme } from 'styled-components';
import { theme } from '../../../theme';
import { ExperimentalProvider } from '../../../contexts/experimental';
import { EXPERIMENTAL_FLAGS_STORAGE_KEY } from '../../../contexts/experimental/consts';

// Card reads theme.colors.primary[6] from the styled-components theme; provide the
// minimal shape (mirrors index.test.tsx).
const scTheme = {
  colors: {
    background: ['#26282b', '#373b40', '#3f434a', '#50565e', '#6c7582'],
    primary: ['#fcebde', '#f9d8be', '#f7c59f', '#f4b17f', '#f19e60', '#ef8b40', '#ec7821'],
  },
} as unknown as DefaultTheme;

// Stub the heavy tabs (solver / react-flow) — irrelevant to the header switches.
vi.mock('./ProductionGraphTab', () => ({ default: () => <div data-testid="graph-tab" /> }));
vi.mock('./FlowTab', () => ({ default: () => <div data-testid="flow-tab" /> }));
vi.mock('./ReportTab', () => ({ default: () => <div data-testid="report-tab" /> }));

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

describe('PlannerResults balancer toggles — accessibility', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders the enabled toggle group without axe violations', async () => {
    // Flag on so both switches are in the DOM and get scanned.
    window.localStorage.setItem(EXPERIMENTAL_FLAGS_STORAGE_KEY, JSON.stringify({ 'balancer-view': true }));
    const { container } = renderResults();
    await screen.findByTestId('graph-tab');
    expect(screen.getByLabelText('Dedicated lines')).toBeInTheDocument();

    // `region` is a page-level rule (content must sit in a landmark); irrelevant to
    // a tab panel rendered in isolation without the app's surrounding layout.
    const results = await axe(container, { rules: { region: { enabled: false } } });
    expect(results).toHaveNoViolations();
  });

  it('gives each switch an accessible description beyond its label', async () => {
    window.localStorage.setItem(EXPERIMENTAL_FLAGS_STORAGE_KEY, JSON.stringify({ 'balancer-view': true }));
    renderResults();
    await screen.findByTestId('graph-tab');

    // The explanatory text (also shown on hover via Tooltip) must be wired to the
    // input via aria-describedby, not left as a sighted-only Tooltip.
    expect(screen.getByLabelText('Dedicated lines')).toHaveAccessibleDescription(/dedicated lines that feed a single consumer/i);
    expect(screen.getByLabelText('Belt/pipe needs')).toHaveAccessibleDescription(/belts\/pipes it needs/i);
  });
});
