import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from 'styled-components';
import { Section, SectionDescription } from './index';
import { theme } from '../../theme';

// Minimal styled-components theme matching the shape Section's CSS expects
// (Section reads theme.colors.background[1]).
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

describe('Section component — accessibility', () => {
  it('renders without axe violations', async () => {
    const { container } = render(
      <Wrapper>
        <Section>
          <SectionDescription>Sample description text</SectionDescription>
          <p>Section content</p>
        </Section>
      </Wrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders a section with a heading without axe violations', async () => {
    const { container } = render(
      <Wrapper>
        <Section>
          <h2>Section Title</h2>
          <p>Section body content for accessibility testing.</p>
        </Section>
      </Wrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
