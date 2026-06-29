import React, { useEffect, useState } from 'react';
import { Loader, Title, Button } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import styled from 'styled-components';
import bgImage from '../../assets/stripe-bg.png';
import { useGameDataContext } from '../../contexts/gameData';
import { ProductionProvider } from '../../contexts/production';
import ExternalLink from '../../components/ExternalLink';
import Drawer, { TOGGLE_TAB_CLEARANCE } from '../Drawer';
import PlannerOptions from './PlannerOptions';
import PlannerResults from './PlannerResults';
// The factory switcher renders as native segmented tabs at the top of the main body.
import FactorySwitcher from './PlannerOptions/FactorySwitcher';
import Portal from '../../components/Portal';
import { useSessionStorage } from '../../hooks/useSessionStorage';

const ProductionPlanner = () => {
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
                  <Button
                    style={{ marginTop: '20px' }}
                    onClick={() => { window.location.href = window.location.pathname; }}
                  >
                    Start a new factory
                  </Button>
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
          reinitToken={gdCtx.reinitToken}
        >
          <PlannerLayout>
            <Drawer open={drawerOpen === 'true'} onToggle={(value) => { setDrawerOpen(value ? 'true' : 'false'); }}>
              <PlannerOptions />
            </Drawer>
            <MainContent>
              {/* The Welcome card is relocated into the drawer (WelcomeCard); the
                  factory switcher takes the top of the body. */}
              <FactorySwitcher />
              <PlannerResults />
              <FooterContent>
                <FooterText>
                  Originally made with ♥ by <ExternalLink href='https://github.com/lydianlights'>LydianLights</ExternalLink>
                  {' | '} Updated by <ExternalLink href='https://github.com/greven145/yet-another-factory-planner'>Greven145</ExternalLink>
                  {' '} - Questions or bugs? File an <ExternalLink href='https://github.com/greven145/yet-another-factory-planner/issues'>issue on github</ExternalLink>
                </FooterText>
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
  height: calc(100vh - ${({ theme }) => theme.other.headerHeight});
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

// Fills exactly the space the graph reserves below itself (GRAPH_BOTTOM_RESERVE
// in ProductionGraphTab) and centers the credits, so MainContent never scrolls
// and there's no dead gap on wide screens. Keep min-height in sync with it.
const FooterContent = styled.div`
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 20px;
`;

const FooterText = styled.div`
  text-align: center;
  font-size: 12px;
  line-height: 1.4;
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
