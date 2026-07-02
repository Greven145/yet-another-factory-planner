import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import ExperimentalModal from './ExperimentalModal';
import { theme } from '../../../theme';
import { ExperimentalProvider } from '../../../contexts/experimental';

// Renders the modal OPEN so the flag switches are actually in the DOM and get
// scanned (the SiteHeader a11y test only covers the closed trigger). Note: axe
// under jsdom cannot evaluate colour-contrast — that needs a real browser — so
// this guards structure/roles/labels/aria, not visual contrast.
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <ExperimentalProvider>{children}</ExperimentalProvider>
    </MantineProvider>
  );
}

describe('ExperimentalModal — accessibility', () => {
  it('renders the open dialog without axe violations', async () => {
    render(
      <Wrapper>
        <ExperimentalModal opened onClose={() => {}} />
      </Wrapper>
    );

    // Mantine renders the Modal in a portal on document.body, so scan the body.
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
