import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Button, Select, TextInput, Checkbox, Group, Text } from '@mantine/core';
import { useProductionContext } from '../../../../contexts/production';
import TrashButton from '../../../../components/TrashButton';
import { CollapsibleSection } from '../../../../components/Section';

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
          <Row wrap='nowrap' align='center' gap='xs'>
            <Select
              placeholder="Select an item"
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
              style={{ flex: '1 1 0' }}
            />
            <TextInput
              aria-label='Input item amount'
              placeholder='Amount'
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
              style={{ width: '110px' }}
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
            />
            <TrashButton onClick={() => { ctx.dispatch({ type: 'DELETE_INPUT_ITEM', key: data.key }); }} />
          </Row>
        </ItemContainer>
      )
    });
  }

  function renderResourceInputs() {
    return (
      <ResourceTable>
        <ResourceTableHeader>
          <ResourceHeaderCell>Resource</ResourceHeaderCell>
          <ResourceHeaderCell style={{ textAlign: 'right' }}>Amount</ResourceHeaderCell>
          <ResourceHeaderCell style={{ textAlign: 'center' }} title='Unlimited'>∞</ResourceHeaderCell>
          <ResourceHeaderCell style={{ textAlign: 'right' }}>Weight</ResourceHeaderCell>
        </ResourceTableHeader>
        {ctx.state.inputResources.map((data) => (
          <ResourceRow key={data.key}>
            <ResourceName>{ctx.gameData.items[data.itemKey].name}</ResourceName>
            <TextInput
              aria-label={`${ctx.gameData.items[data.itemKey].name} amount`}
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
              styles={{ input: { textAlign: 'right' } }}
            />
            <ResourceCheckboxCell>
              <Checkbox
                aria-label={`${ctx.gameData.items[data.itemKey].name} unlimited`}
                checked={data.unlimited}
                onChange={(e) => {
                  ctx.dispatch({
                    type: 'UPDATE_INPUT_RESOURCE',
                    data: { ...data, unlimited: e.currentTarget.checked },
                  });
                }}
              />
            </ResourceCheckboxCell>
            <TextInput
              aria-label={`${ctx.gameData.items[data.itemKey].name} weight`}
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
              styles={{ input: { textAlign: 'right' } }}
            />
          </ResourceRow>
        ))}
      </ResourceTable>
    );
  }

  return (
    <>
      <CollapsibleSection title='Input Items' tooltip='Items supplied to the factory from outside. Set an amount or mark them unlimited.'>
        {renderItemInputs()}
        <Button onClick={() => { ctx.dispatch({ type: 'ADD_INPUT_ITEM' }) }}>
          + Add Input
        </Button>
      </CollapsibleSection>
      <CollapsibleSection title='Raw Resources' tooltip='Set how much of each raw resource is available and its weight. Weight is a relative cost the solver pays per unit consumed: raise it to make a resource "precious" so the solver avoids it and favours recipes that lean on cheaper resources; lower it (or set 0) to use it freely. Weights are relative to each other and only take effect when Resource Efficiency (under Weighting Options) is above 0.'>
        <Group style={{ marginBottom: '12px' }}>
          <Button color='danger.8' onClick={() => { ctx.dispatch({ type: 'SET_RESOURCES_TO_MAP_LIMITS', gameData: ctx.gameData }) }}>
            Set All To Maximum
          </Button>
          <Button color='danger.8' onClick={() => { ctx.dispatch({ type: 'SET_RESOURCES_TO_0' }) }}>
            Set All To 0
          </Button>
        </Group>
        <Checkbox
          label='Allow hand-gathered resources (mycelia, flower petals, etc)'
          checked={ctx.state.allowHandGatheredItems}
          onChange={(e) => { ctx.dispatch({ type: 'SET_ALLOW_HAND_GATHERED_ITEMS', active: e.currentTarget.checked }) }}
          style={{ marginBottom: '12px' }}
        />
        {renderResourceInputs()}
      </CollapsibleSection>
    </>
  );
};

export default InputsTab;

const Row = styled(Group)`
  margin-bottom: 5px;
`;

const ItemContainer = styled.div`
  margin-bottom: 15px;
`;

const ResourceTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ResourceTableHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px 52px 80px;
  gap: 6px;
  padding: 4px 6px 6px;
  border-bottom: 1px solid light-dark(#dee2e6, #50565e);
  margin-bottom: 2px;
`;

const ResourceHeaderCell = styled.div`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.72;
  color: light-dark(#212529, #eee);
`;

const ResourceRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px 52px 80px;
  gap: 6px;
  align-items: center;
  padding: 3px 6px;
  border-radius: 3px;

  &:hover {
    background: light-dark(#e9ecef, #50565e);
  }
`;

const ResourceName = styled(Text)`
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ResourceCheckboxCell = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
