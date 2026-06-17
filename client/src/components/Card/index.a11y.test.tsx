import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from 'styled-components';
import Card from './index';
import { theme } from '../../theme';

// Minimal styled-components theme matching the shape Card's CSS expects
// (Card reads theme.colors.primary[6] for its left border).
const scTheme = {
  colors: {
    background: ['#26282b', '#373b40', '#3f434a', '#50565e', '#6c7582'],
    primary: ['#fcebde', '#f9d8be', '#f7c59f', '#f4b17f', '#f19e60', '#ef8b40', '#ec7821'],
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <ThemeProvider theme={scTheme}>
        {children}
      </ThemeProvider>
    </MantineProvider>
  );
}

describe('Card component — accessibility', () => {
  it('renders without axe violations', async () => {
    const { container } = render(
      <Wrapper>
        <Card>
          <h2>Card Title</h2>
          <p>Card body content for accessibility testing.</p>
        </Card>
      </Wrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
