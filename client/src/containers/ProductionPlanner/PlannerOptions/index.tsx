import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Container, Tabs, Paper, Title, Divider, Group, Button, Switch, Space, TextInput, Popover, Text, Modal } from '@mantine/core';
import { TrendingUp, Shuffle, Box } from 'react-feather';
import { useProductionContext } from '../../../contexts/production';
import ProductionTab from './ProductionTab';
import InputsTab from './InputsTab';
import RecipesTab from './RecipesTab';
import { usePrevious } from '../../../hooks/usePrevious';

const PlannerOptions = () => {
  const ctx = useProductionContext();
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const prevShareLink = usePrevious(ctx.shareLink.link);
  useEffect(() => {
    if (ctx.shareLink.copyToClipboard && ctx.shareLink.link && ctx.shareLink.link !== prevShareLink) {
      navigator.clipboard.writeText(ctx.shareLink.link);
      setPopoverOpened(true);
    }
  }, [ctx.shareLink, prevShareLink]);

  useEffect(() => {
    if (!popoverOpened) return;
    const timer = setTimeout(() => { setPopoverOpened(false); }, 3000);
    return () => clearTimeout(timer);
  }, [popoverOpened]);

  const handleLinkInputClicked = () => {
    if (ctx.shareLink) {
      navigator.clipboard.writeText(ctx.shareLink.link);
      setPopoverOpened(true);
    }
  }
  
  return (
    <>
      <Paper style={{ marginBottom: '20px', paddingTop: '10px' }}>
        <Title order={2}>Control Panel</Title>
        <Divider style={{ marginTop: '5px', marginBottom: '15px' }} />
        <Group style={{ marginBottom: '15px' }}>
          <Button
            onClick={() => { ctx.calculate(); }}
            disabled={ctx.autoCalculate}
            style={{ marginRight: '15px', width: '125px' }}
          >
            Calculate
          </Button>
          <Switch
            size='md'
            label='Auto-calculate (disable if things get laggy)'
            checked={ctx.autoCalculate}
            onChange={(e) => { ctx.setAutoCalculate(e.currentTarget.checked); }}
          />
        </Group>
        <Group style={{ marginBottom: '15px' }}>
          <Button
            color='green'
            onClick={() => { ctx.generateShareLink(); }}
            loading={ctx.shareLink.loading}
            style={{ width: '125px' }}
          >
            Save & Share
          </Button>
          <Popover
            opened={popoverOpened}
            onClose={() => setPopoverOpened(false)}
            position='right'
            withArrow
          >
            <Popover.Target>
              <TextInput
                value={ctx.shareLink.link}
                placeholder='Save factory to generate a link'
                readOnly={true}
                onClick={() => { handleLinkInputClicked(); }}
                style={{ flex: '1 1 auto' }}
              />
            </Popover.Target>
            <Popover.Dropdown>
              <Text>Link copied!</Text>
            </Popover.Dropdown>
          </Popover>
        </Group>
        <Space />
        <Group style={{ marginBottom: '15px' }} justify='flex-end'>
          <Button
            color='red'
            onClick={() => { setResetConfirmOpen(true); }}
          >
            Reset ALL Factory Options
          </Button>
        </Group>
      </Paper>
      <Modal
        opened={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset ALL Factory Options"
      >
        <Text>Are you sure? This will clear all production goals, inputs, and recipe settings.</Text>
        <Group justify='flex-end' style={{ marginTop: '20px' }}>
          <Button variant='default' onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
          <Button
            color='red'
            onClick={() => {
              ctx.dispatch({ type: 'RESET_FACTORY', gameData: ctx.gameData });
              setResetConfirmOpen(false);
            }}
          >
            Reset
          </Button>
        </Group>
      </Modal>
      <Tabs defaultValue="production" variant='outline'>
        <Tabs.List grow>
          <Tabs.Tab value="production" leftSection={<TrendingUp size={18} />}>Production</Tabs.Tab>
          <Tabs.Tab value="inputs" leftSection={<Shuffle size={18} />}>Inputs</Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<Box size={18} />}>Recipes</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="production">
          <TabContainer fluid>
            <ProductionTab />
          </TabContainer>
        </Tabs.Panel>
        <Tabs.Panel value="inputs">
          <TabContainer fluid>
            <InputsTab />
          </TabContainer>
        </Tabs.Panel>
        <Tabs.Panel value="recipes">
          <TabContainer fluid>
            <RecipesTab />
          </TabContainer>
        </Tabs.Panel>
      </Tabs>
    </>
  );
};

export default PlannerOptions;

const TabContainer = styled(Container)`
  padding: 15px 15px;
  background: var(--yafp-container-bg);
`;
