import React, { useState } from 'react';
import { Container, Menu, Button } from 'semantic-ui-react';
import GraphTab from './GraphTab';
import BuildingsTab from './BuildingsTab';
import { ProductionGraphAlgorithm, ProductionGraph } from '../../../utilities/production-calculator';
import { useProductionContext } from '../../../contexts/production';

const PlannerResults = () => {
  const [activeTab, setActiveTab] = useState('graph');
  const [graph, setGraph] = useState<ProductionGraph | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const ctx = useProductionContext();

  function handleCalculateFactory() {
    const alg = new ProductionGraphAlgorithm(ctx.state);
    try {
      const graphResults = alg.exec();
      setGraph(graphResults);
      setErrorMessage('');
    } catch (e: any) {
      setGraph(null);
      setErrorMessage(e.message);
    }
  }

  function handleSetTab(e: any, data: any) {
    setActiveTab(data.name);
  }

  function renderTab() {
    switch (activeTab) {
      case 'graph':
        return <GraphTab activeGraph={graph} errorMessage={errorMessage} />
      case 'buildings':
        return <BuildingsTab />
      default:
        return null;
    }
  }

  return (
    <Container fluid>
      <Menu pointing secondary attached="top">
        <Menu.Item
          name='graph'
          active={activeTab === 'graph'}
          onClick={handleSetTab}
        >
          Production Graph
        </Menu.Item>
        <Menu.Item
          name='buildings'
          active={activeTab === 'buildings'}
          onClick={handleSetTab}
        >
          Buildings
        </Menu.Item>
      </Menu>
      <div style={{ padding: '20px 0px' }}>
        <Button primary onClick={handleCalculateFactory} style={{ marginBottom: '10px' }}>
          Calculate
        </Button>
        {renderTab()}
      </div>
    </Container>
  );
};

export default PlannerResults;
