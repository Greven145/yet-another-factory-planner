// The Configure view of the mobile shell: the four planner option tabs
// (Production / Inputs / Recipes / Buildings) stacked as collapsible accordion
// sections instead of a tab strip, so there are no sub-tabs to hunt through on a
// phone. Production starts expanded. Each section wraps the same real tab the
// desktop drawer uses.
import React from 'react';
import { Accordion } from '@mantine/core';
import { TrendingUp, Shuffle, Box, Tool } from 'react-feather';
import ProductionTab from '../PlannerOptions/ProductionTab';
import InputsTab from '../PlannerOptions/InputsTab';
import RecipesTab from '../PlannerOptions/RecipesTab';
import BuildingsTab from '../PlannerOptions/BuildingsTab';

const ConfigSections = () => (
  <Accordion multiple defaultValue={['production']} variant="separated">
    <Accordion.Item value="production">
      <Accordion.Control icon={<TrendingUp size={18} />}>Production</Accordion.Control>
      <Accordion.Panel><ProductionTab /></Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="inputs">
      <Accordion.Control icon={<Shuffle size={18} />}>Inputs</Accordion.Control>
      <Accordion.Panel><InputsTab /></Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="recipes">
      <Accordion.Control icon={<Box size={18} />}>Recipes</Accordion.Control>
      <Accordion.Panel><RecipesTab /></Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="buildings">
      <Accordion.Control icon={<Tool size={18} />}>Buildings</Accordion.Control>
      <Accordion.Panel><BuildingsTab /></Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);

export default ConfigSections;
