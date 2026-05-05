import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { AppShell, Center, Container, Loader, useMantineTheme } from '@mantine/core';
import SiteHeader from './SiteHeader';
import PaypalButton from '../../components/PaypalButton';
import ExternalLink from '../../components/ExternalLink';
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
          <Footer>
            <FooterContent>
              Originally made with ♥ by <ExternalLink href='https://github.com/lydianlights'>LydianLights</ExternalLink>
              {' '} | Updated by <ExternalLink href='https://github.com/greven145/yet-another-factory-planner'>Greven145</ExternalLink>
              {' '} - Questions or bugs? File an <ExternalLink href='https://github.com/greven145/yet-another-factory-planner/issues'>issue on github</ExternalLink>
            </FooterContent>
            <PaypalButton />
          </Footer>
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

const Footer = styled(Container)`
  margin-top: 40px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const FooterContent = styled(Container)`
  padding: 10px 20px;
  color: light-dark(#555555, #eeeeee);
  /* background: rgba(0, 0, 0, 0.3); */
`;
