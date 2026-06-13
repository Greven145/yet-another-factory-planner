import React from 'react';
import styled from 'styled-components';
import { Title, Text, Container, Group } from '@mantine/core';
import { AlertCircle } from 'react-feather';
import { useProductionContext } from '../../../../contexts/production';
import { ProducedItemInformation } from '../../../../utilities/production-solver/models';

function formatFloat(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

const ReportTab = () => {
  const ctx = useProductionContext();
  const report = ctx.solverResults?.report;

  function renderReport() {
    return (
      <>
        <SectionTitle order={2}>Statistics</SectionTitle>
        <StatGrid>
          <StatCard>
            <StatLabel>Points Produced</StatLabel>
            <StatValue>{formatFloat(report!.pointsProduced)}<StatUnit>/min</StatUnit></StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Resource Usage Score</StatLabel>
            <StatValue>{formatFloat(report!.resourceEfficiencyScore)}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Total Build Area</StatLabel>
            <StatValue>{formatFloat(report!.totalBuildArea)}<StatUnit> m²</StatUnit></StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Est. Foundations</StatLabel>
            <StatValue>{formatFloat(report!.estimatedFoundations)}</StatValue>
            <StatSub>{formatFloat(report!.estimatedFoundations * 8)} Concrete</StatSub>
          </StatCard>
        </StatGrid>

        <SectionTitle order={2}>Power</SectionTitle>
        <StatGrid>
          <StatCard>
            <StatLabel>Manufacturing</StatLabel>
            <StatValue>{formatFloat(report!.powerUsageEstimate.production)}<StatUnit> MW</StatUnit></StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Extraction</StatLabel>
            <StatValue>{formatFloat(report!.powerUsageEstimate.extraction)}<StatUnit> MW</StatUnit></StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Generation</StatLabel>
            <StatValue>{formatFloat(report!.powerUsageEstimate.generators)}<StatUnit> MW</StatUnit></StatValue>
          </StatCard>
          <StatCard $accent>
            <StatLabel>Total {report!.powerUsageEstimate.total < 0 ? 'Production' : 'Usage'}</StatLabel>
            <StatValue>{formatFloat(Math.abs(report!.powerUsageEstimate.total))}<StatUnit> MW</StatUnit></StatValue>
          </StatCard>
        </StatGrid>

        <SectionTitle order={2}>Summary of Produced Items</SectionTitle>
        {renderLoopWarning()}
        {renderSteps()}

        <SectionTitle order={2}>Buildings</SectionTitle>
        {renderBuildingsUsed()}
      </>
    );
  }

  function renderSteps() {
    return Object.entries(groupBy(report!.totalItemsRecap, i => i.step)).map((value) => (
      <StepBlock key={value[0]}>
        <StepTitle order={3}>Step {value[0]}</StepTitle>
        <ItemsGrid>
          {renderItems(value[1])}
        </ItemsGrid>
      </StepBlock>
    ));
  }

  function renderItems(itemsList: ProducedItemInformation[]) {
    return Object.entries(itemsList).map(([key, itemInfo]) => (
      <ItemCell key={itemInfo.key}>
        <ItemCellName>{itemInfo.name}</ItemCellName>
        <ItemCellRate>{formatFloat(itemInfo.amount)}/min</ItemCellRate>
      </ItemCell>
    ));
  }

  function renderLoopWarning() {
    if (report!.loopWarning) {
      return (
        <LoopWarning>
          ⚠️ Warning: A loop was detected — these values may not be reliable
        </LoopWarning>
      );
    }
    return null;
  }

  function renderBuildingsUsed() {
    return (
      <BuildingsGrid>
        {Object.entries(report!.buildingsUsed)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([buildingKey, usageInfo]) => (
            <BuildingCard key={buildingKey}>
              <BuildingName>
                {ctx.gameData.buildings[buildingKey].name}
                <BuildingCount> ×{formatFloat(usageInfo.count)}</BuildingCount>
              </BuildingName>
              <BuildingMaterials>
                {Object.entries(usageInfo.materialCost)
                  .sort((a, b) => b[1] - a[1])
                  .map(([itemKey, count]) => (
                    <MaterialRow key={itemKey}>
                      <span>{ctx.gameData.items[itemKey].name}</span>
                      <MaterialCount>×{formatFloat(count)}</MaterialCount>
                    </MaterialRow>
                  ))}
              </BuildingMaterials>
            </BuildingCard>
          ))}
        <BuildingCard $total>
          <BuildingName>Total Materials</BuildingName>
          <BuildingMaterials>
            {Object.entries(report!.totalMaterialCost)
              .sort((a, b) => b[1] - a[1])
              .map(([itemKey, count]) => (
                <MaterialRow key={itemKey}>
                  <span>{ctx.gameData.items[itemKey].name}</span>
                  <MaterialCount>×{formatFloat(count)}</MaterialCount>
                </MaterialRow>
              ))}
          </BuildingMaterials>
        </BuildingCard>
      </BuildingsGrid>
    );
  }

  return (
    <ReportContainer fluid>
      {!report
        ? (
          <Group style={{ height: '150px', justifyContent: 'flex-start' }}>
            <AlertCircle color="#eee" size={50} />
            <Text style={{ fontSize: '32px' }}>
              No data available
            </Text>
          </Group>
        )
        : renderReport()
      }
    </ReportContainer>
  );
};

const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>);

export default ReportTab;

const ReportContainer = styled(Container)`
  padding: 10px;
  padding-bottom: 20px;
`;

const SectionTitle = styled(Title)`
  margin-top: 20px;
  margin-bottom: 10px;
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.8;

  &:first-child {
    margin-top: 0;
  }
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 4px;
`;

const StatCard = styled.div<{ $accent?: boolean }>`
  background: ${({ theme, $accent }) => $accent ? theme.colors.primary[8] : theme.colors.background[2]};
  border-radius: 4px;
  padding: 12px 14px;
`;

const StatLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: light-dark(#666, #aaa);
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: light-dark(#212529, #eee);
  line-height: 1.1;
`;

const StatUnit = styled.span`
  font-size: 14px;
  font-weight: 400;
  opacity: 0.7;
`;

const StatSub = styled.div`
  font-size: 12px;
  opacity: 0.6;
  margin-top: 2px;
`;

const StepBlock = styled.div`
  margin-bottom: 12px;
`;

const StepTitle = styled(Title)`
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
  margin-bottom: 6px;
`;

const ItemsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
`;

const ItemCell = styled.div`
  background: ${({ theme }) => theme.colors.background[2]};
  border-radius: 4px;
  padding: 8px 10px;
  min-width: 0;
`;

const ItemCellName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: light-dark(#212529, #eee);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
`;

const ItemCellRate = styled.div`
  font-size: 12px;
  color: light-dark(#555, #aaa);
`;

const LoopWarning = styled.div`
  background: ${({ theme }) => theme.colors.danger[6]};
  color: #fff;
  border-radius: 4px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
`;

const BuildingsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
`;

const BuildingCard = styled.div<{ $total?: boolean }>`
  background: ${({ theme, $total }) => $total ? theme.colors.background[3] : theme.colors.background[2]};
  border-radius: 4px;
  padding: 10px 12px;
`;

const BuildingName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: light-dark(#212529, #eee);
  margin-bottom: 8px;
`;

const BuildingCount = styled.span`
  font-weight: 400;
  opacity: 0.7;
  font-size: 13px;
`;

const BuildingMaterials = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const MaterialRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: light-dark(#555, #bbb);
`;

const MaterialCount = styled.span`
  font-weight: 600;
  color: light-dark(#212529, #eee);
`;
