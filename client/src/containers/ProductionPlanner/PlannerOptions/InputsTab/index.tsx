import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Button, Select, TextInput, Checkbox, Group, Title, Divider, Text } from '@mantine/core';
import { useProductionContext } from '../../../../contexts/production';
import TrashButton from '../../../../components/TrashButton';
import { Section, SectionDescription } from '../../../../components/Section';
import LabelWithTooltip from '../../../../components/LabelWithTooltip';
import { TransportOptions } from '../../../../contexts/production/types';

const BELT_TIER_OPTIONS = [
  { value: 'disabled', label: 'Disabled' },
  { value: '60', label: 'Mk. 1 (60/min)' },
  { value: '120', label: 'Mk. 2 (120/min)' },
  { value: '240', label: 'Mk. 3 (240/min)' },
  { value: '480', label: 'Mk. 4 (480/min)' },
  { value: '780', label: 'Mk. 5 (780/min)' },
  { value: '1200', label: 'Mk. 6 (1200/min)' },
  { value: 'custom', label: 'Custom' },
];

const BELT_PRESET_VALUES = new Set(['60', '120', '240', '480', '780', '1200']);

const PIPE_TIER_OPTIONS = [
  { value: 'disabled', label: 'Disabled' },
  { value: '300', label: 'Mk. 1 (300 m³/min)' },
  { value: '600', label: 'Mk. 2 (600 m³/min)' },
  { value: 'custom', label: 'Custom' },
];

const PIPE_PRESET_VALUES = new Set(['300', '600']);

function getSelectValue(capacity: string | null, presets: Set<string>): string {
  if (capacity === null) return 'disabled';
  if (presets.has(capacity)) return capacity;
  return 'custom';
}



const InputsTab = () => {
  const ctx = useProductionContext();
  
  const itemOptions = useMemo(() => Object.keys(ctx.gameData.items)
    .filter((key) => ctx.gameData.items[key].producedFromRecipes.length !== 0 && ctx.gameData.items[key].usedInRecipes.length !== 0 && !ctx.gameData.resources[key])
    .map((key) => ({
      value: key,
      label: ctx.gameData.items[key].name,
    }))
    .sort((a, b) => {
      return a.label > b.label ? 1 : -1;
    }), [ctx.gameData])

  function renderItemInputs() {
    return ctx.state.inputItems.map((data) => {
      return (
        <ItemContainer key={data.key}>
          <Row>
            <Select
              placeholder="Select an item"
              label='Item'
              clearable
              searchable
              data={itemOptions}
              value={data.itemKey || null}
              onChange={(value) => {
                ctx.dispatch({
                  type: 'UPDATE_INPUT_ITEM',
                  data: { ...data, itemKey: value || '' },
                });
              }}
              style={{ flex: '1 1 auto' }}
            />
            <TrashButton onClick={() => { ctx.dispatch({ type: 'DELETE_INPUT_ITEM', key: data.key }); }} style={{ position: 'relative', top: '13px' }} />
          </Row>
          <Row>
            <TextInput
              label='Amount'
              className='no-spinner'
              type='number'
              min='0'
              step='1'
              disabled={data.unlimited}
              value={data.value}
              onChange={(e) => {
                ctx.dispatch({
                  type: 'UPDATE_INPUT_ITEM',
                  data: { ...data, value: e.currentTarget.value },
                });
              }}
            />
            <Checkbox
              className='label'
              label='Unlimited'
              checked={data.unlimited}
              onChange={() => {
                ctx.dispatch({
                  type: 'UPDATE_INPUT_ITEM',
                  data: { ...data, unlimited: !data.unlimited },
                });
              }}
              style={{ position: 'relative', top: '13px' }}
            />
          </Row>
          <Divider style={{ marginTop: '10px', marginBottom: '10px' }} />
        </ItemContainer>
      )
    });
  }

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
              if (!value || value === 'disabled') {
                dispatchBelt(null);
              } else if (value === 'custom') {
                dispatchBelt(opts.beltCapacity && !BELT_PRESET_VALUES.has(opts.beltCapacity) ? opts.beltCapacity : '60');
              } else {
                dispatchBelt(value);
              }
            }}
          />
          {beltSelectValue === 'custom' && (
            <TextInput
              label='Custom (items/min)'
              className='no-spinner'
              type='number'
              min='1'
              step='1'
              value={opts.beltCapacity ?? ''}
              style={{ flex: '1 1 auto' }}
              onChange={(e) => dispatchBelt(e.currentTarget.value)}
            />
          )}
        </Group>
        <Group style={{ alignItems: 'flex-end' }}>
          <Select
            label={<LabelWithTooltip label='Pipe Capacity' tooltip='Maximum m³ per minute any single pipe can carry. When set, the solver will only produce solutions where each recipe node outputs no more than this amount per fluid type.' />}
            data={PIPE_TIER_OPTIONS}
            value={pipeSelectValue}
            style={{ flex: '1 1 auto' }}
            onChange={(value) => {
              if (!value || value === 'disabled') {
                dispatchPipe(null);
              } else if (value === 'custom') {
                dispatchPipe(opts.pipeCapacity && !PIPE_PRESET_VALUES.has(opts.pipeCapacity) ? opts.pipeCapacity : '300');
              } else {
                dispatchPipe(value);
              }
            }}
          />
          {pipeSelectValue === 'custom' && (
            <TextInput
              label='Custom (m³/min)'
              className='no-spinner'
              type='number'
              min='1'
              step='1'
              value={opts.pipeCapacity ?? ''}
              style={{ flex: '1 1 auto' }}
              onChange={(e) => dispatchPipe(e.currentTarget.value)}
            />
          )}
        </Group>
      </>
    );
  }

  function renderResourceInputs() {
    return ctx.state.inputResources.map((data) => (
      <ItemContainer key={data.key}>
        <Row>
          <Text style={{ fontWeight: 'bold' }}>{ctx.gameData.items[data.itemKey].name}</Text>
        </Row>
        <Row>
          <TextInput
            label='Amount'
            className='no-spinner'
            type='number'
            min='0'
            step='1'
            value={data.value}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_INPUT_RESOURCE',
                data: { ...data, value: e.currentTarget.value },
              });
            }}
            disabled={data.unlimited}
            style={{ flex: '1 1 auto' }}
          />
          <Checkbox
            label='Unlimited'
            checked={data.unlimited}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_INPUT_RESOURCE',
                data: { ...data, unlimited: e.currentTarget.checked },
              });
            }}
            style={{ position: 'relative', top: '13px', flex: '1 1 auto' }}
          />
          <TextInput
            label='Weight'
            className='no-spinner'
            type='number'
            min='0'
            step='1'
            value={data.weight}
            onChange={(e) => {
              ctx.dispatch({
                type: 'UPDATE_INPUT_RESOURCE',
                data: { ...data, weight: e.currentTarget.value },
              });
            }}
            style={{ flex: '0 0 100px' }}
          />
        </Row>
        <Divider style={{ marginTop: '10px', marginBottom: '10px' }} />
      </ItemContainer>
    ));
  }

  return (
    <>
      <Section>
        <Title order={3}>Input Items</Title>
        <SectionDescription>
          Select the items that you already have available and don't need to produce in this factory.
        </SectionDescription>
        {renderItemInputs()}
        <Button onClick={() => { ctx.dispatch({ type: 'ADD_INPUT_ITEM' }) }}>
          + Add Input
        </Button>
      </Section>
      <Section>
        <Title order={3}>Weighting Options</Title>
        <SectionDescription>
          Adjust the weights affecting the importance of various properties of the factory. A value of 0 indicates that that property is not considered during factory layout.
        </SectionDescription>
        {renderWeightInputs()}
        <Button color='red' onClick={() => { ctx.dispatch({ type: 'SET_ALL_WEIGHTS_DEFAULT', gameData: ctx.gameData }) }} style={{ marginTop: '15px' }}>
          Reset All Weights
        </Button>
      </Section>
      <Section>
        <Title order={3}>Transport Capacity</Title>
        <SectionDescription>
          Constrain the solver to only produce solutions where each recipe node's output rate does not exceed a single belt or pipe's capacity. Useful for planning factories within physical transport limits.
        </SectionDescription>
        {renderTransportOptions()}
      </Section>
      <Section>
        <Title order={3}>Raw Resources</Title>
        <SectionDescription>
          Select the raw resources that are available to your factory. The default values are set to the map limits. The weight value is a number representing how valuable that resource is when comparing recipes. The defaults are calculated automatically according to node rarity.
        </SectionDescription>
        <Group style={{ marginBottom: '15px' }}>
          <Button color='red' onClick={() => { ctx.dispatch({ type: 'SET_RESOURCES_TO_MAP_LIMITS', gameData: ctx.gameData }) }}>
            Set All To Maximum
          </Button>
          <Button color='red' onClick={() => { ctx.dispatch({ type: 'SET_RESOURCES_TO_0' }) }}>
            Set All To 0
          </Button>
        </Group>
        <Checkbox
          label='Allow hand-gathered resources (mycelia, flower petals, etc)'
          checked={ctx.state.allowHandGatheredItems}
          onChange={(e) => { ctx.dispatch({ type: 'SET_ALLOW_HAND_GATHERED_ITEMS', active: e.currentTarget.checked }) }}
          style={{ marginBottom: '25px' }}
          />
        {renderResourceInputs()}
      </Section>
    </>
  );
};

export default InputsTab;

const Row = styled(Group)`
  margin-bottom: 5px;
`;

const ItemContainer = styled.div`
  margin-bottom: 20px;
`;
