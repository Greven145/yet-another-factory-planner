import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Container, Group, Text, VisuallyHidden } from '@mantine/core';
import { AlertCircle } from 'react-feather';
import { useProductionContext } from '../../../../contexts/production';
import { buildFlowModel } from '../../../../utilities/production-solver/flow-model';
import { decomposeGraph } from '../../../../utilities/production-solver/decompose-graph';
import FlowCards from './FlowCards';

type FlowTabProps = {
  // When true, show dedicated lines: each step feeds a single consumer (see decompose-graph.ts).
  dedicatedLines?: boolean,
  // When true, annotate each flow with its belt/pipe requirement (see transport.ts).
  showTransport?: boolean,
};

function parseCapacity(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Accessible, non-canvas equivalent of the production graph (issue #92, ADR 0002).
// Renders the solved plan as a semantic table and announces recomputes via an ARIA
// live region so screen-reader and keyboard users can read the plan without the canvas.
const FlowTab = ({ dedicatedLines = false, showTransport = false }: FlowTabProps) => {
  const ctx = useProductionContext();
  const rawGraph = ctx.solverResults?.productionGraph ?? null;
  const timestamp = ctx.solverResults?.timestamp ?? null;
  const loopWarning = ctx.solverResults?.report?.loopWarning ?? false;
  const transportOptions = ctx.state.transportOptions;

  const graph = useMemo(
    () => (rawGraph && dedicatedLines ? decomposeGraph(rawGraph, ctx.gameData) : rawGraph),
    [rawGraph, dedicatedLines, ctx.gameData],
  );

  const transportCaps = useMemo(
    () => (showTransport
      ? {
        beltCapacity: parseCapacity(transportOptions.beltCapacity),
        pipeCapacity: parseCapacity(transportOptions.pipeCapacity),
      }
      : undefined),
    [showTransport, transportOptions.beltCapacity, transportOptions.pipeCapacity],
  );

  const model = useMemo(
    () => (graph ? buildFlowModel(graph, ctx.gameData, transportCaps) : null),
    [graph, ctx.gameData, transportCaps],
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
            <FlowCards model={model} />
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
