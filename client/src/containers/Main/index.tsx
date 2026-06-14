import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { AppShell, Center, Container, Loader, useMantineTheme } from '@mantine/core';
import SiteHeader from './SiteHeader';
import ErrorBoundary from '../ErrorBoundary';

const ProductionPlanner = lazy(() => import('../ProductionPlanner'));

const Main = () => {
  const theme = useMantineTheme();
  return (
    <AppShell
      padding='md'
      header={{ height: theme.other.headerHeight }}
    >
      <AppShell.Header>
        <SiteHeader />
      </AppShell.Header>
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
`;

const PlannerLoader = styled(Center)`
  min-height: 40vh;
`;
