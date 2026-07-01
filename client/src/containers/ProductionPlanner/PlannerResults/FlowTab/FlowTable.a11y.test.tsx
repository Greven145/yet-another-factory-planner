import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import FlowTable from './FlowTable';
import { FlowModel } from '../../../../utilities/production-solver/flow-model';

const model: FlowModel = {
  rawInputs: [{ itemKey: 'Desc_OreIron', itemName: 'Iron Ore', rate: 30 }],
  finalProducts: [{ itemKey: 'Desc_IronPlate', itemName: 'Iron Plate', rate: 20 }],
  recipes: [
    {
      id: 'ingot',
      recipeKey: 'Recipe_IronIngot',
      recipeName: 'Iron Ingot',
      buildingKey: 'Build_Smelter',
      buildingName: 'Smelter',
      buildingCount: 1,
      inputs: [{ itemKey: 'Desc_OreIron', itemName: 'Iron Ore', rate: 30, endpointKind: 'raw', endpointLabel: 'Iron Ore' }],
      outputs: [{ itemKey: 'Desc_IronIngot', itemName: 'Iron Ingot', rate: 30, endpointKind: 'recipe', endpointLabel: 'Iron Plate' }],
    },
    {
      id: 'plate',
      recipeKey: 'Recipe_IronPlate',
      recipeName: 'Iron Plate',
      buildingKey: 'Build_Constructor',
      buildingName: 'Constructor',
      buildingCount: 2,
      inputs: [{ itemKey: 'Desc_IronIngot', itemName: 'Iron Ingot', rate: 30, endpointKind: 'recipe', endpointLabel: 'Iron Ingot' }],
      outputs: [{ itemKey: 'Desc_IronPlate', itemName: 'Iron Plate', rate: 20, endpointKind: 'final', endpointLabel: 'Iron Plate' }],
    },
  ],
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('FlowTable — accessibility', () => {
  it('renders a column-headed table of the production steps', () => {
    render(<Wrapper><FlowTable model={model} /></Wrapper>);

    expect(screen.getByRole('columnheader', { name: 'Recipe' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Building' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Inputs' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Outputs' })).toBeInTheDocument();

    // recipe names are row headers (scope="row")
    expect(screen.getByRole('rowheader', { name: 'Iron Ingot' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Iron Plate' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Wrapper><FlowTable model={model} /></Wrapper>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
