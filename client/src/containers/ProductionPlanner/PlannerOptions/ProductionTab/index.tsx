import React, { useMemo, useRef } from 'react';
import styled from 'styled-components';
import { Button, Select, TextInput, Group, Divider, Title } from '@mantine/core';
import { useProductionContext } from '../../../../contexts/production';
import { POINTS_ITEM_KEY } from '../../../../utilities/production-solver/models';
import { MAX_PRIORITY } from '../../../../contexts/production/consts';
import { Section, SectionDescription } from '../../../../components/Section';
import TrashButton from '../../../../components/TrashButton';
import { ProductionItemOptions } from '../../../../contexts/production/types';


const baseModeOptions = [
  { value: 'per-minute', label: 'Items Per Min' },
  { value: 'maximize', label: 'Maximize Output' },
];

const priorityOptions = Array(MAX_PRIORITY)
.fill('')
  .map((_, i) => ({ value: `${i + 1}`, label: `Priority: ${i + 1}` }))
  .reverse();

interface ItemRowProps {
  data: ProductionItemOptions;
  itemOptions: { value: string; label: string }[];
  gameData: any;
  dispatch: (action: any) => void;
}

const ProductionItemRow = ({ data, itemOptions, gameData, dispatch }: ItemRowProps) => {
  const justFocusedRef = useRef(false);

  const modeOptions = useMemo(() => {
    const opts = [...baseModeOptions];
    if (data.itemKey) {
      const itemInfo = gameData.items[data.itemKey];
      const recipeList = itemInfo?.producedFromRecipes || [];
      recipeList.forEach((recipeKey: string) => {
        const recipeInfo = gameData.recipes[recipeKey];
        const target = recipeInfo?.products.find((p: any) => p.itemClass === data.itemKey);
        if (target) {
          const name = itemInfo.name === recipeInfo.name ? 'Base Recipe' : recipeInfo.name.replace('Alternate: ', '');
          opts.push({ value: recipeKey, label: `${name} [${target.perMinute}/min]` });
        }
      });
    }
    return opts;
  }, [data.itemKey, gameData]);

  return (
    <ItemContainer>
      <Row>
        <Select
          placeholder='Select an item'
          label='Item'
          clearable
          searchable
          data={itemOptions}
          value={data.itemKey || null}
          onFocus={() => { justFocusedRef.current = true; }}
          onBlur={() => { justFocusedRef.current = false; }}
          onKeyDown={(e) => {
            if (justFocusedRef.current) {
              justFocusedRef.current = false;
              (e.currentTarget as HTMLInputElement).select();
            }
          }}
          onChange={(value) => {
            dispatch({
              type: 'SET_PRODUCTION_ITEM',
              data: { key: data.key, itemKey: value || '' },
            });
          }}
          style={{ flex: '1 1 auto' }}
        />
        <TrashButton onClick={() => { dispatch({ type: 'DELETE_PRODUCTION_ITEM', key: data.key }); }} style={{ position: 'relative', top: '13px' }} />
      </Row>
      <Row>
        {
          data.mode === 'maximize'
            ? (
              <Select
                label='Priority'
                data={priorityOptions}
                value={data.value}
                onChange={(value) => {
                  dispatch({
                    type: 'SET_PRODUCTION_ITEM_AMOUNT',
                    data: { key: data.key, amount: (value as any) },
                  });
                }}
                style={{ width: '160px' }}
              />
            )
            : (
              <TextInput
                label='Amount'
                className='no-spinner'
                type='number'
                min='0'
                step='1'
                value={data.value}
                onChange={(e) => {
                  dispatch({
                    type: 'SET_PRODUCTION_ITEM_AMOUNT',
                    data: { key: data.key, amount: e.currentTarget.value },
                  });
                }}
                style={{ width: '160px' }}
              />
            )
        }
        <Select
          label='Mode'
          data={modeOptions}
          value={data.mode}
          onChange={(value) => {
            dispatch({
              type: 'SET_PRODUCTION_ITEM_MODE',
              data: { key: data.key, mode: (value as any) },
            });
          }}
          style={{ width: '280px' }}
        />
      </Row>
      <Divider style={{ marginTop: '10px', marginBottom: '10px' }} />
    </ItemContainer>
  );
};

const ProductionTab = () => {
  const ctx = useProductionContext();

  const itemOptions = useMemo(() => {
    const opts = Object.keys(ctx.gameData.items)
      .filter((key) => ctx.gameData.items[key].producedFromRecipes.length !== 0 && !ctx.gameData.resources[key])
      .map((key) => ({
        value: key,
        label: ctx.gameData.items[key].name,
      }))
      .sort((a, b) => {
        return a.label > b.label ? 1 : -1;
      });

    opts.unshift({
      value: POINTS_ITEM_KEY,
      label: 'AWESOME Sink Points (x1000)'
    });

    return opts;
  }, [ctx.gameData]);

  return (
    <>
      <Section>
        <Title order={3}>Production Goals</Title>
        <SectionDescription>
          Select the items you want to produce. When maximizing multiple outputs, higher priority items will be maximized first. When selecting a recipe as a target, the factory will be forced to use that recipe for the final output.
        </SectionDescription>
        {ctx.state.productionItems.map((data) => (
          <ProductionItemRow
            key={data.key}
            data={data}
            itemOptions={itemOptions}
            gameData={ctx.gameData}
            dispatch={ctx.dispatch}
          />
        ))}
        <Button onClick={() => { ctx.dispatch({ type: 'ADD_PRODUCTION_ITEM' }) }}>
          + Add Product
        </Button>
      </Section>
    </>
  );
};

export default ProductionTab;

const Row = styled(Group)`
  margin-bottom: 5px;
`;

const ItemContainer = styled.div`
  margin-bottom: 20px;
`;
