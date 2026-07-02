import React, { Suspense, lazy, useState } from 'react';
import { Center, Group, Loader, Switch, Tabs, Tooltip } from '@mantine/core';
import { Share2, Edit, List } from 'react-feather';
import Card from '../../../components/Card';
import { useExperimentalFlag } from '../../../contexts/experimental';

const ProductionGraphTab = lazy(() => import('./ProductionGraphTab'));
const FlowTab = lazy(() => import('./FlowTab'));
const ReportTab = lazy(() => import('./ReportTab'));

const TabLoader = () => (
  <Center py="xl">
    <Loader size="lg" />
  </Center>
);

const PlannerResults = () => {
  // Balancer-mode view state. Both are pure view toggles, off by default, and do
  // not affect the solve. Shared by the Graph and Flow tabs.
  //  - Dedicated lines: decompose so each production node feeds a single consumer (decompose-graph.ts).
  //  - Belt/pipe needs: annotate each flow with its transport requirement (transport.ts).
  const [dedicatedLines, setDedicatedLines] = useState(false);
  const [showTransport, setShowTransport] = useState(false);

  // The balancer-mode view toggles are gated behind an experimental flag. When
  // the flag is off the switches are absent from the DOM and the effect is
  // forced off, so a stale `true` state can't leak into the tabs.
  const balancerView = useExperimentalFlag('balancer-view');

  return (
    <Tabs defaultValue="graph" variant='pills' className='segmented-tabs'>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Tabs.List>
          <Tabs.Tab value="graph" leftSection={<Share2 size={16} />}>Graph</Tabs.Tab>
          <Tabs.Tab value="flow" leftSection={<List size={16} />}>Flow</Tabs.Tab>
          <Tabs.Tab value="report" leftSection={<Edit size={16} />}>Report</Tabs.Tab>
        </Tabs.List>
        {balancerView && (
          <Group align="center" wrap="nowrap" gap="md" style={{ flexShrink: 0 }}>
            <Tooltip
              multiline
              w={260}
              label="Split each production step into dedicated lines that feed a single consumer, duplicating shared intermediates. Affects the Graph and Flow tabs only."
            >
              <Switch
                checked={dedicatedLines}
                onChange={(e) => setDedicatedLines(e.currentTarget.checked)}
                label="Dedicated lines"
                size="sm"
              />
            </Tooltip>
            <Tooltip
              multiline
              w={260}
              label="Label each flow with the belts/pipes it needs, counted against the Belt/Pipe Capacity option (or the smallest tier that fits when it's disabled)."
            >
              <Switch
                checked={showTransport}
                onChange={(e) => setShowTransport(e.currentTarget.checked)}
                label="Belt/pipe needs"
                size="sm"
              />
            </Tooltip>
          </Group>
        )}
      </Group>
      <Tabs.Panel value="graph" keepMounted>
        <Card style={{ padding: '0px', marginBottom: '0px', background: 'var(--yafp-container-bg)' }}>
          <Suspense fallback={<TabLoader />}>
            <ProductionGraphTab dedicatedLines={balancerView && dedicatedLines} showTransport={balancerView && showTransport} />
          </Suspense>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel value="flow">
        <Card style={{ paddingLeft: '10px', background: 'var(--yafp-container-bg)' }}>
          <Suspense fallback={<TabLoader />}>
            <FlowTab dedicatedLines={balancerView && dedicatedLines} showTransport={balancerView && showTransport} />
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
