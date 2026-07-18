import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { Title, Text, Divider, List, useMantineTheme, Paper } from '@mantine/core';
import { truncateFloat } from '../../utilities/number';
import { NODE_TYPE } from '../../utilities/production-solver/models';
import { buildVariant, sloopSlotsFor, variantLabel, OC_THROUGHPUT_MULT } from '../../utilities/production-solver/amplification';
import { NodeData } from '../../containers/ProductionPlanner/PlannerResults/ProductionGraphTab';
import Portal from '../Portal';
import { useProductionContext } from '../../contexts/production';

interface Props {
  currentNode: NodeData | null,
}

const GraphTooltip = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { currentNode } = props;
  const theme = useMantineTheme();
  const ctx = useProductionContext();

  function renderInner() {
    const data = currentNode!;
    if (data.type === NODE_TYPE.RECIPE) {
      return renderRecipeInfo(data);
    }
    if (data.type === NODE_TYPE.RESOURCE) {
      if (data.key === 'Desc_Water_C') {
        return renderWaterExtractorInfo(data);
      } else if (data.key === 'Desc_LiquidOil_C') {
        return renderOilExtractorInfo(data);
      } else if (data.key === 'Desc_NitrogenGas_C') {
        return null;
      }
      return renderMinerInfo(data);
    }
    return null;
  }

  function renderRecipeInfo(data: NodeData) {
    const recipeInfo = ctx.gameData.recipes[data.key];
    const primaryProduct = recipeInfo.products[0];

    // Boost variant (somersloops/power shards) scales throughput and, for overclocking, the clock.
    const variant = buildVariant(data.suffix ?? '', sloopSlotsFor(recipeInfo.producedIn));
    const isOverclocked = data.suffix === 'OC' || data.suffix === 'AMPOC';
    const maxClock = isOverclocked ? 100 * OC_THROUGHPUT_MULT : 100;

    const totalBuildings = Math.ceil(data.multiplier);
    const clockPercentage = data.multiplier / totalBuildings * maxClock;
    const itemsPerMinPerBuilding = primaryProduct.perMinute * variant.outputMult * data.multiplier / totalBuildings;

    return (
      <Tooltip>
        <TooltipTitle order={3}>Recipe: [{recipeInfo.name}{variantLabel(data.suffix)}]</TooltipTitle>
        <TooltipDivider />
        <TooltipText>
          <b>Buildings:</b> {totalBuildings}x {ctx.gameData.buildings[recipeInfo.producedIn].name}
        </TooltipText>
        <TooltipText>
          <b>Clock speed:</b> {truncateFloat(clockPercentage)}% each
        </TooltipText>
        {variant.sloops > 0 && (
          <TooltipText>
            <b>Somersloops:</b> {variant.sloops} each ({variant.sloops * totalBuildings} total)
          </TooltipText>
        )}
        {variant.shards > 0 && (
          <TooltipText>
            <b>Power shards:</b> {variant.shards} each ({variant.shards * totalBuildings} total)
          </TooltipText>
        )}
        <TooltipText>
          <b>Items per min:</b> {truncateFloat(itemsPerMinPerBuilding)} each
        </TooltipText>
        <TooltipDivider />
        <TooltipText><b>Inputs:</b></TooltipText>
        <List listStyleType='none' withPadding>
          {
            recipeInfo.ingredients.map((ingredient) => (
              <List.Item key={ingredient.itemClass}>
                <TooltipText>{ctx.gameData.items[ingredient.itemClass].name}: {truncateFloat(ingredient.perMinute * variant.inputMult * data.multiplier)} / min</TooltipText>
              </List.Item>
            ))
          }
        </List>
        <TooltipText><b>Outputs:</b></TooltipText>
        <List listStyleType='none' withPadding>
          {
            recipeInfo.products.map((product) => (
              <List.Item key={product.itemClass}>
                <TooltipText>{ctx.gameData.items[product.itemClass].name}: {truncateFloat(product.perMinute * variant.outputMult * data.multiplier)} / min</TooltipText>
              </List.Item>
            ))
          }
        </List>
      </Tooltip>
    );
  }

  function renderMinerInfo(data: NodeData) {
    const itemInfo = ctx.gameData.items[data.key];
    const baseNumMiners = data.multiplier / 60;
    return (
      <Tooltip>
        <TooltipTitle order={3}>Resource: [{itemInfo.name}]</TooltipTitle>
        <TooltipDivider />
        <TooltipText><b>Miners required (assuming normal nodes):</b></TooltipText>
        <Table>
          <thead>
            <tr>
              <th></th>
              <th>100%</th>
              <th>150%</th>
              <th>200%</th>
              <th>250%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Mk. 1</th>
              <td>{truncateFloat(baseNumMiners, 2)}x</td>
              <td>{truncateFloat(baseNumMiners / 1.5, 2)}x</td>
              <td>{truncateFloat(baseNumMiners / 2.0, 2)}x</td>
              <td>{truncateFloat(baseNumMiners / 2.5, 2)}x</td>
            </tr>
            <tr>
              <th>Mk. 2</th>
              <td>{truncateFloat(0.5 * baseNumMiners, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumMiners / 1.5, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumMiners / 2.0, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumMiners / 2.5, 2)}x</td>
            </tr>
            <tr>
              <th>Mk. 3</th>
              <td>{truncateFloat(0.25 * baseNumMiners, 2)}x</td>
              <td>{truncateFloat(0.25 * baseNumMiners / 1.5, 2)}x</td>
              <td>{truncateFloat(0.25 * baseNumMiners / 2.0, 2)}x</td>
              <td>{truncateFloat(0.25 * baseNumMiners / 2.5, 2)}x</td>
            </tr>
          </tbody>
        </Table>
      </Tooltip>
    );
  }

  function renderWaterExtractorInfo(data: NodeData) {
    const itemInfo = ctx.gameData.items[data.key];
    return (
      <Tooltip>
        <TooltipTitle order={3}>Resource: [{itemInfo.name}]</TooltipTitle>
        <TooltipDivider />
        <TooltipText><b>Extractors required:</b> {truncateFloat(data.multiplier / 120, 2)}x Water Extractor</TooltipText>
      </Tooltip>
    );
  }

  function renderOilExtractorInfo(data: NodeData) {
    const itemInfo = ctx.gameData.items[data.key];
    const baseNumExtractors = data.multiplier / 120;
    return (
      <Tooltip>
        <TooltipTitle order={3}>Resource: [{itemInfo.name}]</TooltipTitle>
        <TooltipDivider />
        <TooltipText><b>Extractors required:</b></TooltipText>
        <Table>
          <thead>
            <tr>
              <th></th>
              <th>100%</th>
              <th>150%</th>
              <th>200%</th>
              <th>250%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Impure</th>
              <td>{truncateFloat(2.0 * baseNumExtractors, 2)}x</td>
              <td>{truncateFloat(2.0 * baseNumExtractors / 1.5, 2)}x</td>
              <td>{truncateFloat(2.0 * baseNumExtractors / 2.0, 2)}x</td>
              <td>{truncateFloat(2.0 * baseNumExtractors / 2.5, 2)}x</td>
            </tr>
            <tr>
              <th>Normal</th>
              <td>{truncateFloat(baseNumExtractors, 2)}x</td>
              <td>{truncateFloat(baseNumExtractors / 1.5, 2)}x</td>
              <td>{truncateFloat(baseNumExtractors / 2.0, 2)}x</td>
              <td>{truncateFloat(baseNumExtractors / 2.5, 2)}x</td>
            </tr>
            <tr>
              <th>Pure</th>
              <td>{truncateFloat(0.5 * baseNumExtractors, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumExtractors / 1.5, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumExtractors / 2.0, 2)}x</td>
              <td>{truncateFloat(0.5 * baseNumExtractors / 2.5, 2)}x</td>
            </tr>
          </tbody>
        </Table>
      </Tooltip>
    );
  }

  return (
    <Portal ref={ref} createRoot style={{ zIndex: theme.other.tooltipZIndex, pointerEvents: 'none' }}>
      {currentNode ? renderInner() : null}
    </Portal>
  );
});

export default GraphTooltip;

const Tooltip = styled(Paper)`
  background: ${({ theme }) => theme.colors.background[2]};
  border: 1px solid #aaa;
  min-width: 300px;

  ::before {
    content: '';
    position: absolute;
    left: calc(50% - 10px);
    bottom: -12px;
    width: 20px;
    height: 20px;
    background: ${({ theme }) => theme.colors.background[2]};
    border-bottom: 1px solid #aaa;
    border-right: 1px solid #aaa;

    transform: rotate(45deg);
    z-index: 1;
  }
`;

const TooltipTitle = styled(Title)`
  font-size: 16px;
`;

const TooltipText = styled(Text)`
  font-size: 15px;
`;

const TooltipDivider = styled(Divider)`
  margin-top: 10px;
  margin-bottom: 10px;
  border-top-color: ${({ theme }) => theme.colors.background[4]};
`;

const Table = styled.table`
  color: ${({ theme }) => theme.white};
  border-collapse: collapse;

  & th, td {
    padding: 10px;
    text-align: left;
    font-size: 15px;
  }

  & td {
    border: 1px solid ${({ theme }) => theme.colors.background[4]};
  }

  & tr:nth-child(2n) td {
    background: ${({ theme }) => theme.colors.background[3]};
  }
`;
