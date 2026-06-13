import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { UnstyledButton, Text } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { ChevronsLeft, ChevronsRight } from 'react-feather';

interface Props {
  open?: boolean,
  onToggle?: (newState: boolean) => void,
  children: React.ReactNode,
}

const Drawer = (props: Props) => {
  const { open, onToggle, children } = props;
  const [fullyClosed, setFullyClosed] = useState(!open);
  const [tooltipDismissed, setTooltipDismissed] = useLocalStorage<'false' | 'true'>({ key: 'tooltip-dismissed', defaultValue: 'false' });

  const showTooltip = tooltipDismissed === 'false';

  useEffect(() => {
    if (open) {
      setTooltipDismissed('true');
    }
  }, [open, setTooltipDismissed]);

  useEffect(() => {
    if (open) {
      setFullyClosed(false);
    }
  }, [open]);

  function handleTransitionEnd() {
    if (!open) {
      setFullyClosed(true);
    }
    window.dispatchEvent(new Event('resize'));
  }

  return (
    <DrawerOuter open={!!open} onTransitionEnd={handleTransitionEnd}>
      <ClipWrapper>
        <DrawerContent className='custom-scrollbar' aria-hidden={!open} $fullyClosed={fullyClosed}>
          {children}
        </DrawerContent>
      </ClipWrapper>
      <DrawerToggle onClick={() => { onToggle?.(!open); }}>
        <ToggleLabel>
          <ToggleLabelText>{open ? 'Close' : 'Open'} Control Panel</ToggleLabelText>
          <ToggleLabelIcon>
            {open ? <ChevronsLeft /> : <ChevronsRight />}
          </ToggleLabelIcon>
        </ToggleLabel>
        {showTooltip && (
          <Tooltip>
            <TooltipText>
              Click here to get started!
            </TooltipText>
            <TooltipConfirmContainer>
              <TooltipConfirm onClick={(e: any) => { setTooltipDismissed('true'); e.stopPropagation(); }}>
                Dismiss
              </TooltipConfirm>
            </TooltipConfirmContainer>
          </Tooltip>
        )}
      </DrawerToggle>
    </DrawerOuter>
  );
};

export default Drawer;

// How far the tab protrudes past DrawerOuter's right edge (DrawerToggle width + ToggleLabel right shift).
// MainContent uses this to set left padding so content clears the visual tab.
export const TOGGLE_TAB_CLEARANCE = '57px'; // 25px strip + 25px label shift + ~7px buffer

const DrawerOuter = styled.div<{ open: boolean }>`
  position: relative;
  flex: 0 0 auto;
  width: ${({ open, theme }) => open ? theme.other.drawerWidth : '0px'};
  height: 100%;
  transition: width 400ms ease-in-out;
`;

const ClipWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  overflow: hidden;
  background: var(--yafp-drawer-bg);
`;

const DrawerContent = styled.div<{ $fullyClosed: boolean }>`
  visibility: ${({ $fullyClosed }) => $fullyClosed ? 'hidden' : 'visible'};
  position: absolute;
  top: 0px;
  bottom: 0px;
  left: 0px;
  width: ${({ theme }) => theme.other.drawerWidth};
  padding: 10px;
  padding-bottom: 30px;
  overflow: auto;
  overscroll-behavior: contain;
`;

const DrawerToggle = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  top: 0px;
  bottom: 0px;
  right: -25px;
  width: 25px;
  overflow: visible;
  background: ${({ theme }) => theme.colors.primary[6]};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primary[7]};
  }
`;

const ToggleLabel = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  right: -25px;
  width: 30px;
  height: 160px;
  border: none;
  border-radius: 2px;
  font-size: 18px;
  font-weight: bold;
  background: ${({ theme }) => theme.colors.primary[6]};
  color: ${({ theme }) => theme.white};
  overflow: visible;
  white-space: nowrap;
  cursor: pointer;
  padding: 0;

  ${DrawerToggle}:hover & {
    background: ${({ theme }) => theme.colors.primary[7]};
  }

  &::before {
    content: '';
    position: absolute;
    top: -24px;
    right: 2px;
    width: 50px;
    height: 26px;
    background: ${({ theme }) => theme.colors.primary[6]};
    transform: rotate(50deg);
    z-index: 1;

    ${DrawerToggle}:hover & {
      background: ${({ theme }) => theme.colors.primary[7]};
    }
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -24px;
    right: 2px;
    width: 50px;
    height: 26px;
    background: ${({ theme }) => theme.colors.primary[6]};
    transform: rotate(-50deg);
    z-index: 1;

    ${DrawerToggle}:hover & {
      background: ${({ theme }) => theme.colors.primary[7]};
    }
  }
`;

const ToggleLabelText = styled.span`
  position: absolute;
  left: -16px;
  z-index: 2;
  writing-mode: vertical-rl;
  text-orientation: mixed;
`;

const ToggleLabelIcon = styled.span`
  position: absolute;
  left: 5px;
  z-index: 2;
`;

const Tooltip = styled.div`
  @keyframes lookAtMe {
    from { left: 84px; }
    to { left: 80px; }
  }

  animation: 300ms infinite alternate lookAtMe;
  position: absolute;
  left: 80px;
  padding: 20px;
  z-index: 3;
  background: ${({ theme }) => theme.colors.info[6]};
  border-radius: 2px;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: calc(50% - 10px);
    left: -10px;
    width: 20px;
    height: 20px;
    background: ${({ theme }) => theme.colors.info[6]};
    transform: rotate(45deg);
    z-index: -1;
  }
`;

const TooltipText = styled(Text)`
  width: 180px;
  height: 40px;
`;

const TooltipConfirmContainer = styled.div`
  display: flex;
  width: 100%;
  justify-content: flex-end;
`;

const TooltipConfirm: any = styled(UnstyledButton)`
  pointer-events: auto;
  color: ${({ theme }) => theme.white};
  text-decoration: underline;
`;
