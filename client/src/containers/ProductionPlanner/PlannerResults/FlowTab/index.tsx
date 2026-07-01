import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Container, Group, Text, VisuallyHidden } from '@mantine/core';
import { AlertCircle } from 'react-feather';
import { useProductionContext } from '../../../../contexts/production';
import { buildFlowModel } from '../../../../utilities/production-solver/flow-model';
import FlowTable from './FlowTable';

// Accessible, non-canvas equivalent of the production graph (issue #92, ADR 0002).
// Renders the solved plan as a semantic table and announces recomputes via an ARIA
// live region so screen-reader and keyboard users can read the plan without the canvas.
const FlowTab = () => {
  const ctx = useProductionContext();
  const graph = ctx.solverResults?.productionGraph ?? null;
  const timestamp = ctx.solverResults?.timestamp ?? null;
  const loopWarning = ctx.solverResults?.report?.loopWarning ?? false;

  const model = useMemo(
    () => (graph ? buildFlowModel(graph, ctx.gameData) : null),
    [graph, ctx.gameData],
  );

  // Announce each recompute (new solver timestamp) once the plan has data.
  const [announcement, setAnnouncement] = useState('');
  const lastAnnounced = useRef<number | null>(null);
  useEffect(() => {
    if (timestamp == null || model == null) return;
    if (lastAnnounced.current === timestamp) return;
    lastAnnounced.current = timestamp;
    setAnnouncement(`Production plan updated — ${model.recipes.length} recipes.`);
  }, [timestamp, model]);

  return (
    <FlowContainer fluid>
      <VisuallyHidden role="status" aria-live="polite">{announcement}</VisuallyHidden>

      {!model || model.recipes.length === 0
        ? (
          <Group style={{ height: '150px', justifyContent: 'flex-start' }}>
            <AlertCircle size={50} style={{ color: 'light-dark(#868e96, #eee)' }} />
            <Text style={{ fontSize: '32px' }}>No data available</Text>
          </Group>
        )
        : (
          <>
            {loopWarning && (
              <LoopWarning role="alert">
                ⚠️ Warning: A loop was detected — these values may not be reliable.
              </LoopWarning>
            )}
            <FlowTable model={model} />
          </>
        )
      }
    </FlowContainer>
  );
};

export default FlowTab;

const FlowContainer = styled(Container)`
  padding: 10px;
  padding-bottom: 20px;
`;

const LoopWarning = styled.div`
  margin-bottom: 12px;
  color: #d97706;
  font-weight: 600;
`;
