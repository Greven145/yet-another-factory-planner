import React from 'react';
import styled from 'styled-components';
import { AppShell, Header, Container, useMantineTheme } from '@mantine/core';
import SiteHeader from './SiteHeader';
import ProductionPlanner from '../ProductionPlanner';
import PaypalButton from '../../components/PaypalButton';
import ExternalLink from '../../components/ExternalLink';
import ErrorBoundary from '../ErrorBoundary';

const Main = () => {
  const theme = useMantineTheme();
  return (
    <AppShell
      padding='md'
      header={<SHeader height={theme.other.headerHeight}><SiteHeader /></SHeader>}
    >
      <MainContainer fluid>
        <ErrorBoundary>
          <ProductionPlanner />
        </ErrorBoundary>
        <Footer>
          <FooterContent>
            Originall made with ♥ by <ExternalLink href='https://github.com/lydianlights'>LydianLights</ExternalLink> -
            Lovingly updated and maintained by <ExternalLink href='https://github.com/Greven145'>Greven145</ExternalLink> -
            Questions or bugs? File an <ExternalLink href='https://github.com/Greven145/yet-another-factory-planner/issues'>issue on github</ExternalLink>
          </FooterContent>
        </Footer>
      </MainContainer>
    </AppShell>
  );
};

export default Main;

const SHeader = styled(Header)`
  position: fixed;
  margin: 0px;
  padding: 10px;
  background: ${({ theme }) => theme.colors.primary[6]};
  overflow: hidden;
`;

const MainContainer = styled(Container)`
  margin-left: ${({ theme }) => theme.other.pageLeftMargin};
  margin-top: ${({ theme }) => theme.other.headerHeight};
  padding-left: 0px;
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
  color: ${({ theme }) => theme.white};
  /* background: rgba(0, 0, 0, 0.3); */
`;
