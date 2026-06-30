// The mobile shell (promoted from the Variant D prototype): a full-viewport flex
// column that replaces the desktop drawer + main-content layout below
// MOBILE_BREAKPOINT. Top = the slim factory/overflow bar; middle = a scroll area
// that flips between the Configure accordion and the Results view by `mode`;
// bottom = the Configure/Results nav. The factory bottom sheet is mounted here so
// it overlays the whole shell.
//
// Rendered inside ProductionProvider (see ProductionPlanner/index.tsx) so it has
// the production/library/gameData context the real tabs and FactorySwitcher need.
import React, { useState } from 'react';
import styled from 'styled-components';
import { useDisclosure } from '@mantine/hooks';
import PlannerResults from '../PlannerResults';
import MobileTopBar from './MobileTopBar';
import FactorySheet from './FactorySheet';
import ConfigSections from './ConfigSections';
import BottomNav, { MobileMode } from './BottomNav';

const MobileShell = () => {
  const [mode, setMode] = useState<MobileMode>('configure');
  const [factorySheetOpen, factorySheet] = useDisclosure(false);

  return (
    <Shell>
      <MobileTopBar onOpenFactories={factorySheet.open} />
      <Body className="custom-scrollbar">
        {mode === 'configure' ? <ConfigSections /> : <PlannerResults />}
      </Body>
      <BottomNav mode={mode} onChange={setMode} />
      <FactorySheet opened={factorySheetOpen} onClose={factorySheet.close} />
    </Shell>
  );
};

export default MobileShell;

// 100dvh tracks the dynamic viewport so the bar/nav stay pinned as the mobile
// browser chrome grows/shrinks; overflow:hidden keeps the scrolling to <Body>.
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--yafp-body-bg);
`;

const Body = styled.div`
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 16px;
`;
