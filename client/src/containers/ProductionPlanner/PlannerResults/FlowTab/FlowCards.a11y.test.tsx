import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MantineProvider } from '@mantine/core';
import FlowCards from './FlowCards';
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

describe('FlowCards — accessibility', () => {
  it('renders section and per-recipe headings so the plan is navigable', () => {
    render(<Wrapper><FlowCards model={model} /></Wrapper>);

    expect(screen.getByRole('heading', { name: 'Raw inputs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production steps' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final products' })).toBeInTheDocument();

    // each recipe is its own labelled card (region) with a heading
    expect(screen.getByRole('heading', { name: 'Iron Ingot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Iron Plate' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Iron Plate' })).toBeInTheDocument();

    // consumes/produces content is present
    expect(screen.getAllByText('Consumes').length).toBe(2);
    expect(screen.getAllByText('Produces').length).toBe(2);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Wrapper><FlowCards model={model} /></Wrapper>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
