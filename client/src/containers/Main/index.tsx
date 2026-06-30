import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { AppShell, Center, Container, Loader, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import SiteHeader from './SiteHeader';
import ErrorBoundary from '../ErrorBoundary';
import { MOBILE_MEDIA, MOBILE_MEDIA_QUERY } from '../../theme';

const ProductionPlanner = lazy(() => import('../ProductionPlanner'));

const Main = () => {
  const theme = useMantineTheme();
  // The mobile shell is full-bleed (its own top bar + 100dvh column), so below the
  // breakpoint we collapse the desktop AppShell chrome: drop the orange header band,
  // its height, and the main padding/left-margin that otherwise box the shell in.
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY, false, { getInitialValueInEffect: false });
  return (
    <AppShell
      padding={isMobile ? 0 : 'md'}
      header={{ height: isMobile ? 0 : theme.other.headerHeight }}
      styles={isMobile ? { main: { paddingTop: 0, paddingBottom: 0, background: 'transparent' } } : undefined}
    >
      {!isMobile && (
        <AppShell.Header>
          <SiteHeader />
        </AppShell.Header>
      )}
      <AppShell.Main>
        <MainContainer fluid>
          <ErrorBoundary>
            <Suspense fallback={<PlannerLoader><Loader size='xl' /></PlannerLoader>}>
              <ProductionPlanner />
            </Suspense>
          </ErrorBoundary>
        </MainContainer>
      </AppShell.Main>
    </AppShell>
  );
};

export default Main;

const MainContainer = styled(Container)`
  margin-left: ${({ theme }) => theme.other.pageLeftMargin};
  padding-left: 0px;

  ${MOBILE_MEDIA} {
    margin-left: 0;
    padding: 0;
    max-width: 100%;
  }
`;

const PlannerLoader = styled(Center)`
  min-height: 40vh;
`;
