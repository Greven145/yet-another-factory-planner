import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import MobileTopBar from './MobileTopBar';
import { theme } from '../../../theme';
import { GameDataContext, GameDataContextType } from '../../../contexts/gameData';
import { LibraryContext, LibraryContextType } from '../../../contexts/library';
import { ProductionContext, ProductionContextType } from '../../../contexts/production';
import { ExperimentalProvider } from '../../../contexts/experimental';
import { DEFAULT_GAME_VERSION } from '../../../contexts/gameData/consts';

// Minimal context values: MobileTopBar reads the active factory label
// (library + production gameData) and the overflow menu reads gameVersion/loading.
const gameData = { items: {} } as any;

const gameDataValue = {
  gameData,
  initializer: null,
  loading: false,
  loadingError: false,
  completedThisFrame: false,
  reinitToken: 0,
  gameVersion: DEFAULT_GAME_VERSION,
  setGameVersion: vi.fn(),
} as unknown as GameDataContextType;

const libraryValue = {
  factories: [],
  activeId: 'f1',
  activeFactory: { id: 'f1', nickname: 'My Steel Plant', gameVersion: DEFAULT_GAME_VERSION } as any,
} as unknown as LibraryContextType;

const productionValue = { gameData } as unknown as ProductionContextType;

function renderBar(onOpenFactories = vi.fn()) {
  const utils = render(
    <MantineProvider theme={theme}>
      <ExperimentalProvider>
        <GameDataContext.Provider value={gameDataValue}>
          <LibraryContext.Provider value={libraryValue}>
            <ProductionContext.Provider value={productionValue}>
              <MobileTopBar onOpenFactories={onOpenFactories} />
            </ProductionContext.Provider>
          </LibraryContext.Provider>
        </GameDataContext.Provider>
      </ExperimentalProvider>
    </MantineProvider>
  );
  return { ...utils, onOpenFactories };
}

describe('MobileTopBar', () => {
  it('shows the active factory name and opens the factory sheet when tapped', async () => {
    const user = userEvent.setup();
    const { onOpenFactories } = renderBar();

    const factoryButton = screen.getByRole('button', { name: /Factories — current: My Steel Plant/ });
    expect(factoryButton).toHaveTextContent('My Steel Plant');

    await user.click(factoryButton);
    expect(onOpenFactories).toHaveBeenCalledTimes(1);
  });

  it('exposes game version, theme toggle, and GitHub link in the overflow menu', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'More options' }));

    expect(await screen.findByLabelText('Game version')).toBeInTheDocument();
    // Theme toggle label reflects the *other* scheme; match either wording.
    expect(screen.getByText(/(Dark|Light) theme/)).toBeInTheDocument();
    const source = screen.getByText('View source').closest('a');
    expect(source).toHaveAttribute('href', 'https://github.com/greven145/yet-another-factory-planner');
  });

  it('opens the experimental features modal from the overflow menu', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'More options' }));
    const item = await screen.findByText('Experimental features…');
    await user.click(item);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Balancer view/ })).toBeInTheDocument();
  });
});
