import React, { Suspense, lazy } from 'react';
import { Center, Loader, Tabs } from '@mantine/core';
import { Share2, Edit, List } from 'react-feather';
import Card from '../../../components/Card';

const ProductionGraphTab = lazy(() => import('./ProductionGraphTab'));
const FlowTab = lazy(() => import('./FlowTab'));
const ReportTab = lazy(() => import('./ReportTab'));

const TabLoader = () => (
  <Center py="xl">
    <Loader size="lg" />
  </Center>
);

const PlannerResults = () => {
  return (
    <Tabs defaultValue="graph" variant='pills' className='segmented-tabs'>
      <Tabs.List>
        <Tabs.Tab value="graph" leftSection={<Share2 size={16} />}>Graph</Tabs.Tab>
        <Tabs.Tab value="flow" leftSection={<List size={16} />}>Flow</Tabs.Tab>
        <Tabs.Tab value="report" leftSection={<Edit size={16} />}>Report</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="graph" keepMounted>
        <Card style={{ padding: '0px', marginBottom: '0px', background: 'var(--yafp-container-bg)' }}>
          <Suspense fallback={<TabLoader />}>
            <ProductionGraphTab />
          </Suspense>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel value="flow">
        <Card style={{ paddingLeft: '10px', background: 'var(--yafp-container-bg)' }}>
          <Suspense fallback={<TabLoader />}>
            <FlowTab />
          </Suspense>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel value="report">
        <Card style={{ paddingLeft: '10px', background: 'var(--yafp-container-bg)' }}>
          <Suspense fallback={<TabLoader />}>
            <ReportTab />
          </Suspense>
        </Card>
      </Tabs.Panel>
    </Tabs>
  );
};

export default PlannerResults;
