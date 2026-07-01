import React from 'react';
import { Table, Text, Stack, Title, List } from '@mantine/core';
import { FlowConnection, FlowModel, FlowTerminal } from '../../../../utilities/production-solver/flow-model';

function formatRate(n: number) {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}/min`;
}

function renderConnections(connections: FlowConnection[], direction: 'in' | 'out') {
  if (connections.length === 0) {
    return <Text size="sm">—</Text>;
  }
  // "← Smelter" for an input's source, "→ Iron Plate" for an output's destination.
  const arrow = direction === 'in' ? '←' : '→';
  return (
    <List spacing={2} size="sm" listStyleType="none">
      {connections.map((c, i) => (
        <List.Item key={`${c.itemKey}-${c.endpointLabel}-${i}`}>
          {c.itemName} — {formatRate(c.rate)} {arrow} {c.endpointLabel}
        </List.Item>
      ))}
    </List>
  );
}

function renderTerminals(terminals: FlowTerminal[]) {
  return (
    <List spacing={2} size="sm">
      {terminals.map((t) => (
        <List.Item key={t.itemKey}>{t.itemName} — {formatRate(t.rate)}</List.Item>
      ))}
    </List>
  );
}

type Props = {
  model: FlowModel;
};

// A semantic, screen-reader-navigable equivalent of the production graph: one row per
// recipe, with its building and the items flowing in and out. Pure/presentational —
// takes a pre-built FlowModel so it can be unit/axe-tested without the solver or context.
const FlowTable = ({ model }: Props) => {
  return (
    <Stack gap="lg">
      {model.rawInputs.length > 0 && (
        <section aria-labelledby="flow-raw-inputs-heading">
          <Title id="flow-raw-inputs-heading" order={3} size="h4" mb="xs">Raw inputs</Title>
          {renderTerminals(model.rawInputs)}
        </section>
      )}

      <section aria-labelledby="flow-recipes-heading">
        <Title id="flow-recipes-heading" order={3} size="h4" mb="xs">Production steps</Title>
        <Table striped withTableBorder withColumnBorders captionSide="top">
          {/* Mantine's default caption colour is muted and fails AA contrast; use the
              standard body text colour so the description is legible and accessible. */}
          <Table.Caption style={{ color: 'var(--mantine-color-text)' }}>
            Each recipe in the production plan, the building that runs it, and the items
            flowing into and out of it.
          </Table.Caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Recipe</Table.Th>
              <Table.Th scope="col">Building</Table.Th>
              <Table.Th scope="col">Inputs</Table.Th>
              <Table.Th scope="col">Outputs</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {model.recipes.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Th scope="row">{row.recipeName}</Table.Th>
                <Table.Td>
                  {row.buildingName} ×{row.buildingCount.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                </Table.Td>
                <Table.Td>{renderConnections(row.inputs, 'in')}</Table.Td>
                <Table.Td>{renderConnections(row.outputs, 'out')}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </section>

      {model.finalProducts.length > 0 && (
        <section aria-labelledby="flow-final-products-heading">
          <Title id="flow-final-products-heading" order={3} size="h4" mb="xs">Final products</Title>
          {renderTerminals(model.finalProducts)}
        </section>
      )}
    </Stack>
  );
};

export default FlowTable;
