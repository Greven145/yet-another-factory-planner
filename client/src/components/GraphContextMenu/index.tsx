import React from 'react';
import styled from 'styled-components';
import { useMantineTheme } from '@mantine/core';
import { truncateFloat } from '../../utilities/number';
import { NODE_TYPE } from '../../utilities/production-solver/models';
import { buildVariant, sloopSlotsFor, OC_THROUGHPUT_MULT } from '../../utilities/production-solver/amplification';
import { NodeData } from '../../containers/ProductionPlanner/PlannerResults/ProductionGraphTab';
import Portal from '../Portal';
import { useProductionContext } from '../../contexts/production';
import { GameData } from '../../contexts/gameData/types';

interface MenuItem {
  label: string,
  value: string,
}

export interface ContextMenuState {
  node: NodeData,
  x: number,
  y: number,
}

interface Props {
  menu: ContextMenuState | null,
  onClose: () => void,
}

function buildMenuItems(node: NodeData, gameData: GameData): MenuItem[] {
  if (node.type === NODE_TYPE.RECIPE) {
    const recipeInfo = gameData.recipes[node.key];
    const primaryProduct = recipeInfo.products[0];
    const variant = buildVariant(node.suffix ?? '', sloopSlotsFor(recipeInfo.producedIn));
    const isOverclocked = node.suffix === 'OC' || node.suffix === 'AMPOC';
    const maxClock = isOverclocked ? 100 * OC_THROUGHPUT_MULT : 100;
    const totalBuildings = Math.ceil(node.multiplier);
    const clockPercentage = node.multiplier / totalBuildings * maxClock;
    const itemsPerMinPerBuilding = primaryProduct.perMinute * variant.outputMult * node.multiplier / totalBuildings;
    return [
      { label: `Copy clock speed (${truncateFloat(clockPercentage)}%)`, value: truncateFloat(clockPercentage) },
      { label: `Copy items/min per machine (${truncateFloat(itemsPerMinPerBuilding)})`, value: truncateFloat(itemsPerMinPerBuilding) },
    ];
  }
  if (node.type === NODE_TYPE.RESOURCE) {
    return [
      { label: `Copy items/min total (${truncateFloat(node.multiplier)})`, value: truncateFloat(node.multiplier) },
    ];
  }
  return [];
}

const GraphContextMenu = (props: Props) => {
  const { menu, onClose } = props;
  const theme = useMantineTheme();
  const ctx = useProductionContext();

  const items = menu ? buildMenuItems(menu.node, ctx.gameData) : [];

  function handleCopy(value: string) {
    navigator.clipboard?.writeText(value);
    onClose();
  }

  return (
    <Portal createRoot style={{ zIndex: theme.other.tooltipZIndex }}>
      {menu && items.length > 0
        ? (
          <>
            <Backdrop
              onMouseDown={onClose}
              onContextMenu={(e) => e.preventDefault()}
            />
            <Menu
              style={{ left: menu.x, top: menu.y }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {
                items.map((item) => (
                  <MenuButton key={item.label} type='button' onClick={() => handleCopy(item.value)}>
                    {item.label}
                  </MenuButton>
                ))
              }
            </Menu>
          </>
        )
        : null}
    </Portal>
  );
};

export default GraphContextMenu;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: auto;
`;

const Menu = styled.div`
  position: fixed;
  pointer-events: auto;
  min-width: 200px;
  padding: 4px;
  background: ${({ theme }) => theme.colors.background[2]};
  border: 1px solid #aaa;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
`;

const MenuButton = styled.button`
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.white};
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  border-radius: 3px;

  &:hover {
    background: ${({ theme }) => theme.colors.background[4]};
  }
`;
