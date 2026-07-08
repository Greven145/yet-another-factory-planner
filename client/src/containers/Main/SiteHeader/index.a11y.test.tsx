import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, DefaultTheme } from 'styled-components';
import SiteHeader from './index';
import { theme } from '../../../theme';
import { GameDataContext, GameDataContextType } from '../../../contexts/gameData';
import { ExperimentalProvider } from '../../../contexts/experimental';
import { DEFAULT_GAME_VERSION } from '../../../contexts/gameData/consts';

// Minimal styled-components theme matching the shape SiteHeader's CSS expects
// (HeaderContainer reads theme.other.pageLeftMargin).
const scTheme = {
  other: {
    pageLeftMargin: '55px',
  },
} as unknown as DefaultTheme;

// Minimal GameDataContext value: SiteHeader only reads gameVersion, setGameVersion,
// and loading. The rest of the contract is stubbed out.
const gameDataValue = {
  gameData: null,
  initializer: null,
  loading: false,
  loadingError: false,
  shareError: false,
  clearShareError: () => {},
  completedThisFrame: false,
  reinitToken: 0,
  gameVersion: DEFAULT_GAME_VERSION,
  setGameVersion: () => {},
} as GameDataContextType;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <ThemeProvider theme={scTheme}>
        <ExperimentalProvider>
          <GameDataContext.Provider value={gameDataValue}>
            {children}
          </GameDataContext.Provider>
        </ExperimentalProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}

describe('SiteHeader component — accessibility', () => {
  it('renders without axe violations', async () => {
    const { container } = render(
      <Wrapper>
        <SiteHeader />
      </Wrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
