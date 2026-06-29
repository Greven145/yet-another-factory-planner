import React from 'react';
import { ThemeProvider } from 'styled-components';
import { MantineProvider, useMantineTheme } from '@mantine/core';
import Main from './containers/Main';
import { theme } from './theme';
import GlobalStylesheet from './global-stylesheet';
import { GlobalContextProvider } from './contexts/global';
import { LibraryProvider } from './contexts/library';
import { GameDataProvider } from './contexts/gameData';

function App() {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
    >
      <ThemeTransfer />
    </MantineProvider>
  );
}

export default App;

const ThemeTransfer = () => {
  const mergedTheme = useMantineTheme();
  return (
    <ThemeProvider theme={mergedTheme}>
      <GlobalStylesheet />
      <GlobalContextProvider>
        <LibraryProvider>
          <GameDataProvider>
            <Main />
          </GameDataProvider>
        </LibraryProvider>
      </GlobalContextProvider>
    </ThemeProvider>
  );
};
