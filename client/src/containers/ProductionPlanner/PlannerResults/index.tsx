import React, { Suspense, lazy } from 'react';
import { Center, Container, Loader, Tabs } from '@mantine/core';
import { Share2, Edit } from 'react-feather';
import Card from '../../../components/Card';

const ProductionGraphTab = lazy(() => import('./ProductionGraphTab'));
const ReportTab = lazy(() => import('./ReportTab'));

const TabLoader = () => (
  <Center py="xl">
    <Loader size="lg" />
  </Center>
);

const PlannerResults = () => {
  return (
    <Tabs defaultValue="graph" variant='outline'>
      <Tabs.List>
        <Tabs.Tab value="graph" leftSection={<Share2 size={18} />} style={{ minWidth: '200px' }}>Production Graph</Tabs.Tab>
        <Tabs.Tab value="report" leftSection={<Edit size={18} />} style={{ minWidth: '200px' }}>Factory Report</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="graph" keepMounted>
        <Container fluid style={{ padding: '0px' }}>
          <Suspense fallback={<TabLoader />}>
            <ProductionGraphTab />
          </Suspense>
        </Container>
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
