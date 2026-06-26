import React, { useState, useMemo, useCallback } from 'react';
import { List, Checkbox, TextInput, Button, Group } from '@mantine/core';
import { Search } from 'react-feather';
import { useProductionContext } from '../../../../contexts/production';
import { CollapsibleSection } from '../../../../components/Section';

const BuildingsTab = () => {
  const ctx = useProductionContext();
  const [searchValue, setSearchValue] = useState('');

  // The set of selectable buildings is exactly the keys of allowedBuildings,
  // which the reducer derives from recipe.producedIn (recipe-producing machines only).
  const buildings = useMemo(() => {
    return Object.keys(ctx.state.allowedBuildings)
      .map((key) => ({
        key,
        label: ctx.gameData.buildings[key]?.name ?? key,
      }))
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [ctx.gameData, ctx.state.allowedBuildings]);

  const renderBuilding = useCallback(({ key, label }: { key: string, label: string }) => (
    <List.Item key={key}>
      <Checkbox
        label={label}
        checked={ctx.state.allowedBuildings[key]}
        onChange={() => {
          ctx.dispatch({
            type: 'SET_BUILDING_ACTIVE',
            key,
            active: !ctx.state.allowedBuildings[key],
          });
        }}
      />
    </List.Item>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [ctx.state, ctx.dispatch]);

  const filteredBuildings = useMemo(
    () => buildings.filter(({ label }) => label.toLowerCase().includes(searchValue.toLowerCase())),
    [buildings, searchValue],
  );
  const filteredBuildingKeys = filteredBuildings.map(({ key }) => key);

  return (
    <CollapsibleSection title='Buildings' tooltip='Select which production buildings the solver may use. Disabling a building excludes every recipe made in it, regardless of the Recipes tab.'>
      <TextInput
        placeholder='Search...'
        aria-label='search buildings'
        leftSection={<Search size={16} />}
        value={searchValue}
        onChange={(e) => { setSearchValue(e.currentTarget.value); }}
        style={{ marginBottom: '10px' }}
      />
      <Group style={{ marginTop: '5px', marginBottom: '10px' }}>
        <Button onClick={() => { ctx.dispatch({ type: 'MASS_SET_BUILDINGS_ACTIVE', buildings: filteredBuildingKeys, active: true }) }}>
          Select All
        </Button>
        <Button onClick={() => { ctx.dispatch({ type: 'MASS_SET_BUILDINGS_ACTIVE', buildings: filteredBuildingKeys, active: false }) }}>
          Select None
        </Button>
      </Group>
      <List listStyleType='none' style={{ gap: '6px' }}>
        {filteredBuildings.map(renderBuilding)}
      </List>
    </CollapsibleSection>
  );
};

export default BuildingsTab;
