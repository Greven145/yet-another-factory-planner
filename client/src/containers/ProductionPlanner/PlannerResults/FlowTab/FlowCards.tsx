import React from 'react';
import { Card, Text, Stack, Title, List, SimpleGrid } from '@mantine/core';
import { FlowConnection, FlowModel, FlowTerminal } from '../../../../utilities/production-solver/flow-model';

function formatRate(n: number) {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}/min`;
}

function renderConnections(connections: FlowConnection[]) {
  if (connections.length === 0) {
    return <Text size="sm" c="dimmed">None</Text>;
  }
  return (
    <List spacing={2} size="sm" withPadding>
      {connections.map((c, i) => (
        <List.Item key={`${c.itemKey}-${i}`}>{c.itemName} — {formatRate(c.rate)}</List.Item>
      ))}
    </List>
  );
}

function renderTerminals(terminals: FlowTerminal[]) {
  return (
    <List spacing={2} size="sm" withPadding>
      {terminals.map((t) => (
        <List.Item key={t.itemKey}>{t.itemName} — {formatRate(t.rate)}</List.Item>
      ))}
    </List>
  );
}

type Props = {
  model: FlowModel;
};

// A semantic, screen-reader-navigable equivalent of the production graph. Recipes are
// shown as cards in dependency order (raw → final) — each card names the recipe, its
// building, and what it consumes and produces. Pure/presentational: takes a pre-built
// FlowModel so it can be unit/axe-tested without the solver or context.
const FlowCards = ({ model }: Props) => {
  return (
    <Stack gap="xl">
      {model.rawInputs.length > 0 && (
        <section aria-labelledby="flow-raw-inputs-heading">
          <Title id="flow-raw-inputs-heading" order={2} size="h4" mb="xs">Raw inputs</Title>
          {renderTerminals(model.rawInputs)}
        </section>
      )}

      <section aria-labelledby="flow-recipes-heading">
        <Title id="flow-recipes-heading" order={2} size="h4" mb="xs">Production steps</Title>
        <Stack gap="md">
          {model.recipes.map((row) => {
            const headingId = `flow-recipe-${row.id}`;
            return (
              <Card key={row.id} withBorder padding="md" component="section" aria-labelledby={headingId}>
                <Title id={headingId} order={3} size="h5">{row.recipeName}</Title>
                <Text size="sm" mb="sm">
                  {row.buildingName} ×{row.buildingCount.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <div>
                    <Text component="p" fw={600} size="sm" mb={2}>Consumes</Text>
                    {renderConnections(row.inputs)}
                  </div>
                  <div>
                    <Text component="p" fw={600} size="sm" mb={2}>Produces</Text>
                    {renderConnections(row.outputs)}
                  </div>
                </SimpleGrid>
              </Card>
            );
          })}
        </Stack>
      </section>

      {model.finalProducts.length > 0 && (
        <section aria-labelledby="flow-final-products-heading">
          <Title id="flow-final-products-heading" order={2} size="h4" mb="xs">Final products</Title>
          {renderTerminals(model.finalProducts)}
        </section>
      )}
    </Stack>
  );
};

export default FlowCards;
