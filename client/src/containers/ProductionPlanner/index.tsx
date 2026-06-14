import React, { useEffect, useState } from 'react';
import { Loader, Divider, Text, Title } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import styled from 'styled-components';
import bgImage from '../../assets/stripe-bg.png';
import { useGameDataContext } from '../../contexts/gameData';
import { useGlobalContext } from '../../contexts/global';
import { ProductionProvider } from '../../contexts/production';
import Card from '../../components/Card';
import ExternalLink from '../../components/ExternalLink';
import Drawer, { TOGGLE_TAB_CLEARANCE } from '../Drawer';
import PlannerOptions from './PlannerOptions';
import PlannerResults from './PlannerResults';
import Portal from '../../components/Portal';
import { useSessionStorage } from '../../hooks/useSessionStorage';

const ProductionPlanner = () => {
  const globalCtx = useGlobalContext();
  const gdCtx = useGameDataContext();
  const [slowLoad, setSlowLoad] = useState(false);
  const [drawerOpen, setDrawerOpen] = useSessionStorage<'false' | 'true'>({ key: 'drawer-open', defaultValue: 'true' });

  const loaded = !!gdCtx.gameData;
  useEffect(() => {
    setSlowLoad(false);
    if (!loaded) {
      const timer = setTimeout(() => {
        setSlowLoad(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  const renderLoading = () => {
    return (
      <Portal createRoot>
        <AnimatePresence>
          {!gdCtx.gameData && (
            <LoadingOverlay
              $bgImage={bgImage}
              initial={false}
              animate={{ opacity: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0, type: 'tween' }}
            >
              {gdCtx.loadingError ? (
                <>
                  <Title style={{ marginTop: '15px' }}>
                    An error occurred connecting to the server x_x
                  </Title>
                </>
              ) : (
                <>
                  <Loader size='xl' />
                  <Title style={{ marginTop: '15px' }}>
                    Loading game data...
                  </Title>
                  <AnimatePresence>
                    {slowLoad && (
                      <motion.div
                        initial={{ opacity: 0.0, y: 20 }}
                        animate={{ opacity: 1.0, y: 0 }}
                        transition={{ duration: 1.0, type: 'tween' }}
                      >
                        <Title style={{ marginTop: '15px' }}>
                          Trying real hard!
                        </Title>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </LoadingOverlay>
          )}
        </AnimatePresence>
      </Portal>
    );
  }

  return (
    <>
      {renderLoading()}
      {gdCtx.gameData && (
        <ProductionProvider
          gameData={gdCtx.gameData}
          gameVersion={gdCtx.gameVersion}
          initializer={gdCtx.initializer}
          triggerInitialize={gdCtx.completedThisFrame}
        >
          <PlannerLayout>
            <Drawer open={drawerOpen === 'true'} onToggle={(value) => { setDrawerOpen(value ? 'true' : 'false'); }}>
              <PlannerOptions />
            </Drawer>
            <MainContent>
              <WelcomeCard style={{ marginBottom: '20px' }}>
                <Title order={2}>Welcome back &lt;Engineer ID #{globalCtx.engineerId}&gt;</Title>
                <Text>
                  This tool has been created to increase the efficiency of your work towards Project Assembly.<br />
                  We hope that you will continue to be effective.
                </Text>
                <Divider style={{ marginTop: '10px', marginBottom: '10px' }} />
                <Text style={{ fontSize: '13px' }}>{globalCtx.ficsitTip}</Text>
              </WelcomeCard>
              <PlannerResults />
              <FooterContent>
                Originally made with ♥ by <ExternalLink href='https://github.com/lydianlights'>LydianLights</ExternalLink>
                {' '} | Updated by <ExternalLink href='https://github.com/greven145/yet-another-factory-planner'>Greven145</ExternalLink>
                {' '} - Questions or bugs? File an <ExternalLink href='https://github.com/greven145/yet-another-factory-planner/issues'>issue on github</ExternalLink>
              </FooterContent>
            </MainContent>
          </PlannerLayout>
        </ProductionProvider>
      )}
    </>
  );
};

export default ProductionPlanner;

// 80px = AppShell paddingTop override in theme
// The negative margins cancel: MainContainer margin-left (55px) + AppShell.Main padding-left ('md' = 16px)
const PlannerLayout = styled.div`
  display: flex;
  align-items: stretch;
  height: calc(100vh - ${({ theme }) => theme.other.headerHeight} - var(--mantine-spacing-md));
  overflow: hidden;
  margin-top: calc(${({ theme }) => theme.other.headerHeight} - 80px);
  margin-left: calc(-${({ theme }) => theme.other.pageLeftMargin} - var(--mantine-spacing-md));
  margin-right: calc(-1 * var(--mantine-spacing-md));
`;

const MainContent = styled.div`
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 0 12px 0 ${TOGGLE_TAB_CLEARANCE};
`;

const WelcomeCard = styled(Card)`
  flex-shrink: 0;
  margin-top: 12px;
`;

const FooterContent = styled.div`
  text-align: center;
  padding: 20px;
  color: light-dark(#555555, #eeeeee);
`;

const LoadingOverlay = motion.create(styled.div<any>`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  background: url(${({ $bgImage }) => $bgImage});
  background-color: #000;
  z-index: 9999;
`);
