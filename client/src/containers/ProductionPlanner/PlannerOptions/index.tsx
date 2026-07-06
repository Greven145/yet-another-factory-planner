import React from 'react';
import styled from 'styled-components';
import { Container, Tabs } from '@mantine/core';
import { TrendingUp, Shuffle, Box, Tool } from 'react-feather';
import ProductionTab from './ProductionTab';
import InputsTab from './InputsTab';
import RecipesTab from './RecipesTab';
import BuildingsTab from './BuildingsTab';
// The old Calculate/Auto-calc/Save&Share/Reset header is gone: WelcomeCard hosts the
// relocated greeting and the factory switcher lives in the main body (FactorySwitcher).
import WelcomeCard from './WelcomeCard';

const PlannerOptions = () => {
  // Drop the container chrome around the tab sections so the section cards sit flush
  // on the drawer surface, aligned with the Welcome card above.
  const flush = true;

  return (
    <>
      <WelcomeCard />
      <Tabs defaultValue="production" variant='pills' className='segmented-tabs segmented-tabs-grow'>
        <Tabs.List grow>
          <Tabs.Tab value="production" leftSection={<TrendingUp size={16} />}>Production</Tabs.Tab>
          <Tabs.Tab value="inputs" leftSection={<Shuffle size={16} />}>Inputs</Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<Box size={16} />}>Recipes</Tabs.Tab>
          <Tabs.Tab value="buildings" leftSection={<Tool size={16} />}>Buildings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="production">
          <TabContainer fluid $flush={flush}>
            <ProductionTab />
          </TabContainer>
        </Tabs.Panel>
        <Tabs.Panel value="inputs">
          <TabContainer fluid $flush={flush}>
            <InputsTab />
          </TabContainer>
        </Tabs.Panel>
        <Tabs.Panel value="recipes">
          <TabContainer fluid $flush={flush}>
            <RecipesTab />
          </TabContainer>
        </Tabs.Panel>
        <Tabs.Panel value="buildings">
          <TabContainer fluid $flush={flush}>
            <BuildingsTab />
          </TabContainer>
        </Tabs.Panel>
      </Tabs>
    </>
  );
};

export default PlannerOptions;

const TabContainer = styled(Container)<{ $flush?: boolean }>`
  padding: ${({ $flush }) => ($flush ? '0' : '15px 15px')};
  background: ${({ $flush }) => ($flush ? 'transparent' : 'var(--yafp-container-bg)')};

  /* Flatten the section cards' drop-shadow so they read as aligned with the flat
     greeting card above, instead of floating/inset. */
  ${({ $flush }) =>
    $flush &&
    `
    & .mantine-Paper-root { box-shadow: none; }
  `}
`;
