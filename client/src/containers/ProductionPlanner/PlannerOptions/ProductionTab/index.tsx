import React, { useMemo, useRef } from 'react';
import styled from 'styled-components';
import { Button, Select, TextInput, Group, SegmentedControl } from '@mantine/core';
import { useProductionContext } from '../../../../contexts/production';
import { useGameDataContext } from '../../../../contexts/gameData';
import { GV_1_2 } from '../../../../contexts/gameData/consts';
import { POINTS_ITEM_KEY } from '../../../../utilities/production-solver/models';
import { MAX_PRIORITY, MaximizeBalanceMode } from '../../../../contexts/production/consts';
import { CollapsibleSection } from '../../../../components/Section';
import TrashButton from '../../../../components/TrashButton';
import LabelWithTooltip from '../../../../components/LabelWithTooltip';
import { MOBILE_MEDIA } from '../../../../theme';
import { ProductionItemOptions, TransportOptions } from '../../../../contexts/production/types';


const baseModeOptions = [
  { value: 'per-minute', label: 'Items Per Min' },
  { value: 'maximize', label: 'Maximize Output' },
];

const BELT_TIER_OPTIONS = [
  { value: 'disabled', label: 'Disabled' },
  { value: '60', label: 'Mk. 1 (60/min)' },
  { value: '120', label: 'Mk. 2 (120/min)' },
  { value: '240', label: 'Mk. 3 (240/min)' },
  { value: '480', label: 'Mk. 4 (480/min)' },
  { value: '780', label: 'Mk. 5 (780/min)' },
  { value: '1200', label: 'Mk. 6 (1200/min)' },
];

const BELT_PRESET_VALUES = new Set(['60', '120', '240', '480', '780', '1200']);

const PIPE_TIER_OPTIONS = [
  { value: 'disabled', label: 'Disabled' },
  { value: '300', label: 'Mk. 1 (300 m³/min)' },
  { value: '600', label: 'Mk. 2 (600 m³/min)' },
];

const PIPE_PRESET_VALUES = new Set(['300', '600']);

// 1.2 Game Mode cost multipliers — discrete preset values offered by the game.
const RECIPE_COST_MULTIPLIER_OPTIONS = [
  { value: '0.25', label: '0.25x' },
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x (Default)' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
];

const POWER_CONSUMPTION_MULTIPLIER_OPTIONS = [
  { value: '0.25', label: '0.25x' },
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x (Default)' },
  { value: '2', label: '2x' },
  { value: '5', label: '5x' },
];

function getSelectValue(capacity: string | null, presets: Set<string>): string {
  if (capacity !== null && presets.has(capacity)) return capacity;
  return 'disabled';
}

const priorityOptions = Array(MAX_PRIORITY)
.fill('')
  .map((_, i) => ({ value: `${i + 1}`, label: `Rank: ${i + 1}` }))
  .reverse();

interface ItemRowProps {
  data: ProductionItemOptions;
  itemOptions: { value: string; label: string }[];
  gameData: any;
  dispatch: (action: any) => void;
}

const ProductionItemRow = ({ data, itemOptions, gameData, dispatch }: ItemRowProps) => {
  const justFocusedRef = useRef(false);

  const modeOptions = useMemo(() => {
    const opts = [...baseModeOptions];
    if (data.itemKey) {
      const itemInfo = gameData.items[data.itemKey];
      const recipeList = itemInfo?.producedFromRecipes || [];
      recipeList.forEach((recipeKey: string) => {
        const recipeInfo = gameData.recipes[recipeKey];
        const target = recipeInfo?.products.find((p: any) => p.itemClass === data.itemKey);
        if (target) {
          const name = itemInfo.name === recipeInfo.name ? 'Base Recipe' : recipeInfo.name.replace('Alternate: ', '');
          opts.push({ value: recipeKey, label: `${name} [${target.perMinute}/min]` });
        }
      });
    }
    return opts;
  }, [data.itemKey, gameData]);

  return (
    <ItemContainer>
      <Row wrap='nowrap' align='center' gap='xs'>
        <Select
          placeholder='Select an item'
          clearable
          searchable
          data={itemOptions}
          value={data.itemKey || null}
          onFocus={() => { justFocusedRef.current = true; }}
          onBlur={() => { justFocusedRef.current = false; }}
          onKeyDown={(e) => {
            if (justFocusedRef.current) {
              justFocusedRef.current = false;
              (e.currentTarget as HTMLInputElement).select();
            }
          }}
          onChange={(value) => {
            dispatch({
              type: 'SET_PRODUCTION_ITEM',
              data: { key: data.key, itemKey: value || '' },
            });
          }}
          style={{ flex: '1 1 0' }}
        />
        {
          data.mode === 'maximize'
            ? (
              <Select
                placeholder='Rank'
                data={priorityOptions}
                value={data.value}
                onChange={(value) => {
                  dispatch({
                    type: 'SET_PRODUCTION_ITEM_AMOUNT',
                    data: { key: data.key, amount: (value as any) },
                  });
                }}
                style={{ width: '110px' }}
              />
            )
            : (
              <TextInput
                placeholder='Amount'
                className='no-spinner'
                type='number'
                min='0'
                step='1'
                value={data.value}
                onChange={(e) => {
                  dispatch({
                    type: 'SET_PRODUCTION_ITEM_AMOUNT',
                    data: { key: data.key, amount: e.currentTarget.value },
                  });
                }}
                style={{ width: '110px' }}
              />
            )
        }
        <Select
          placeholder='Mode'
          data={modeOptions}
          value={data.mode}
          onChange={(value) => {
            dispatch({
              type: 'SET_PRODUCTION_ITEM_MODE',
              data: { key: data.key, mode: (value as any) },
            });
          }}
          style={{ flex: '1 1 0', minWidth: '150px' }}
        />
        <TrashButton onClick={() => { dispatch({ type: 'DELETE_PRODUCTION_ITEM', key: data.key }); }} />
      </Row>
    </ItemContainer>
  );
};

const balanceModeOptions = [
  { value: 'proportional', label: 'Proportional' },
  { value: 'equal', label: 'Equal output' },
];

const ProductionTab = () => {
  const ctx = useProductionContext();
  const { gameVersion } = useGameDataContext();

  const itemOptions = useMemo(() => {
    const opts = Object.keys(ctx.gameData.items)
      .filter((key) => ctx.gameData.items[key].producedFromRecipes.length !== 0 && !ctx.gameData.resources[key])
      .map((key) => ({
        value: key,
        label: ctx.gameData.items[key].name,
      }))
      .sort((a, b) => {
        return a.label > b.label ? 1 : -1;
      });

    opts.unshift({
      value: POINTS_ITEM_KEY,
      label: 'AWESOME Sink Points (x1000)'
    });

    return opts;
  }, [ctx.gameData]);

  const maximizeCount = ctx.state.productionItems.filter((i) => i.mode === 'maximize').length;

  function renderWeightInputs() {
    const weightingOptions = ctx.state.weightingOptions;
    return (
      <>
        <Group grow>
          <TextInput
            label={<LabelWithTooltip label='Resource Efficiency' tooltip='This weighting prioritizes using as few resources as possible.' />}
            className='no-spinner'
            type='number'
            min='0'
            step='1'
            value={weightingOptions.resources}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_WEIGHTING_OPTIONS',
                data: { ...weightingOptions, resources: e.currentTarget.value },
              });
            }}
          />
          <TextInput
            label={<LabelWithTooltip label='Power Efficiency' tooltip='This weighting prioritizes using as little power as possible.' />}
            className='no-spinner'
            type='number'
            min='0'
            step='1'
            value={weightingOptions.power}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_WEIGHTING_OPTIONS',
                data: { ...weightingOptions, power: e.currentTarget.value },
              });
            }}
          />
        </Group>
        <Group grow style={{ marginTop: '10px' }}>
          <TextInput
            label={<LabelWithTooltip label='Complexity' tooltip='This weighting prioritizes reducing the number of item types used in the factory. Very slow to optimize for larger factories (WIP).' />}
            className='no-spinner'
            type='number'
            min='0'
            step='1'
            value={weightingOptions.complexity}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_WEIGHTING_OPTIONS',
                data: { ...weightingOptions, complexity: e.currentTarget.value },
              });
            }}
          />
          <TextInput
            label={<LabelWithTooltip label='Buildings' tooltip='This weighting prioritizes using as few buildings as possible, discounting overclocking. May not be perfectly optimal, especially for smaller factories (WIP).' />}
            type='number'
            min='0'
            step='1'
            value={weightingOptions.buildings}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_WEIGHTING_OPTIONS',
                data: { ...weightingOptions, buildings: e.currentTarget.value },
              });
            }}
          />
        </Group>
      </>
    )
  }

  function renderGameModeInputs() {
    const gameModeOptions = ctx.state.gameModeOptions;
    return (
      <Group grow>
        <Select
          label={<LabelWithTooltip label='Recipe Cost Multiplier' tooltip='Matches the Recipe Parts Cost multiplier from your save&apos;s Game Mode. Scales crafting ingredient costs (1 = default). Lower values reduce the resources each recipe consumes.' />}
          data={RECIPE_COST_MULTIPLIER_OPTIONS}
          value={gameModeOptions.recipePartsCost}
          onChange={(value) => {
            if (!value) return;
            ctx.dispatch({
              type: 'UPDATE_GAME_MODE_OPTIONS',
              data: { ...gameModeOptions, recipePartsCost: value },
            });
          }}
        />
        <Select
          label={<LabelWithTooltip label='Power Multiplier' tooltip='Matches the Power Consumption multiplier from your save&apos;s Game Mode. Scales building power draw (1 = default).' />}
          data={POWER_CONSUMPTION_MULTIPLIER_OPTIONS}
          value={gameModeOptions.powerConsumption}
          onChange={(value) => {
            if (!value) return;
            ctx.dispatch({
              type: 'UPDATE_GAME_MODE_OPTIONS',
              data: { ...gameModeOptions, powerConsumption: value },
            });
          }}
        />
      </Group>
    )
  }

  function renderTransportOptions() {
    const opts: TransportOptions = ctx.state.transportOptions;
    const beltSelectValue = getSelectValue(opts.beltCapacity, BELT_PRESET_VALUES);
    const pipeSelectValue = getSelectValue(opts.pipeCapacity, PIPE_PRESET_VALUES);

    function dispatchBelt(value: string | null) {
      ctx.dispatch({ type: 'UPDATE_TRANSPORT_OPTIONS', data: { ...opts, beltCapacity: value } });
    }

    function dispatchPipe(value: string | null) {
      ctx.dispatch({ type: 'UPDATE_TRANSPORT_OPTIONS', data: { ...opts, pipeCapacity: value } });
    }

    return (
      <>
        <Group style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
          <Select
            label={<LabelWithTooltip label='Belt Capacity' tooltip='Maximum items per minute any single conveyor belt can carry. When set, the solver will only produce solutions where each recipe node outputs no more than this amount per item type.' />}
            data={BELT_TIER_OPTIONS}
            value={beltSelectValue}
            style={{ flex: '1 1 auto' }}
            onChange={(value) => {
              dispatchBelt(!value || value === 'disabled' ? null : value);
            }}
          />
        </Group>
        <Group style={{ alignItems: 'flex-end' }}>
          <Select
            label={<LabelWithTooltip label='Pipe Capacity' tooltip='Maximum m³ per minute any single pipe can carry. When set, the solver will only produce solutions where each recipe node outputs no more than this amount per fluid type.' />}
            data={PIPE_TIER_OPTIONS}
            value={pipeSelectValue}
            style={{ flex: '1 1 auto' }}
            onChange={(value) => {
              dispatchPipe(!value || value === 'disabled' ? null : value);
            }}
          />
        </Group>
      </>
    );
  }

  return (
    <>
      <CollapsibleSection
        title='Production Goals'
        tooltip='Select the items you want to produce. When maximizing multiple outputs, higher priority items will be maximized first. When selecting a recipe as a target, the factory will be forced to use that recipe for the final output.'
      >
        {maximizeCount >= 2 && (
          <BalanceModeRow>
            <BalanceModeLabel>
              <LabelWithTooltip
                label='Balance mode'
                tooltip='How equal-priority Maximize Output items share capacity. Proportional: each runs at the same fraction of its own maximum. Equal output: all run at the same absolute rate, capped by the hardest to produce.'
              />
            </BalanceModeLabel>
            <SegmentedControl
              size='xs'
              className='hud-segmented'
              data={balanceModeOptions}
              value={ctx.state.maximizeBalanceMode}
              onChange={(value) => {
                ctx.dispatch({ type: 'SET_MAXIMIZE_BALANCE_MODE', mode: value as MaximizeBalanceMode });
              }}
            />
          </BalanceModeRow>
        )}
        {ctx.state.productionItems.map((data) => (
          <ProductionItemRow
            key={data.key}
            data={data}
            itemOptions={itemOptions}
            gameData={ctx.gameData}
            dispatch={ctx.dispatch}
          />
        ))}
        <Button onClick={() => { ctx.dispatch({ type: 'ADD_PRODUCTION_ITEM' }) }}>
          + Add Product
        </Button>
      </CollapsibleSection>
      <CollapsibleSection title='Weighting Options' tooltip='Tune how the solver trades off resources, power, complexity, and building count when optimizing.'>
        {renderWeightInputs()}
        <Button color='danger.8' onClick={() => { ctx.dispatch({ type: 'SET_ALL_WEIGHTS_DEFAULT', gameData: ctx.gameData }) }} style={{ marginTop: '15px' }}>
          Reset All Weights
        </Button>
      </CollapsibleSection>
      {gameVersion === GV_1_2 && (
        <CollapsibleSection title='Game Mode' tooltip='Match the cost multipliers from your save&apos;s Game Mode so the plan reflects your in-game resource and power costs.'>
          {renderGameModeInputs()}
          <Button color='danger.8' onClick={() => { ctx.dispatch({ type: 'UPDATE_GAME_MODE_OPTIONS', data: { recipePartsCost: '1', powerConsumption: '1' } }) }} style={{ marginTop: '15px' }}>
            Reset Game Mode
          </Button>
        </CollapsibleSection>
      )}
      <CollapsibleSection title='Transport Capacity' tooltip='Cap the per-minute throughput of belts and pipes so the solver only produces solutions that fit your logistics tier.'>
        {renderTransportOptions()}
      </CollapsibleSection>
    </>
  );
};

export default ProductionTab;

const Row = styled(Group)`
  margin-bottom: 5px;

  /* Mobile: stacked card. The item dropdown was crushed to a sliver between the
     fixed-width amount and the 150px-min mode select. Wrap so the item picker gets
     the whole first line; amount + mode + trash drop to the next. Drop the fixed
     110px amount width so it flows, and bump touch targets. (!important beats the
     inline flex/width on the Select.) */
  ${MOBILE_MEDIA} {
    flex-wrap: wrap;
    & > *:first-child {
      flex: 1 1 100% !important;
    }
    & > *:nth-child(2) {
      flex: 1 1 90px !important;
      width: auto !important;
    }
    & input {
      min-height: 44px;
    }
  }
`;

const ItemContainer = styled.div`
  margin-bottom: 10px;
`;

const BalanceModeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const BalanceModeLabel = styled.div`
  font-family: 'M PLUS 1 Code', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 13px;
  font-weight: 600;
  color: light-dark(#6b6459, #b0a89c);
`;
