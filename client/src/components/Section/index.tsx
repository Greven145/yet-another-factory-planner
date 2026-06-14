import React, { useState } from 'react';
import styled from 'styled-components';
import { Text, Title, Tooltip, Group, Collapse } from '@mantine/core';
import { Info, ChevronDown } from 'react-feather';
import Card from '../Card';

export const Section = styled(Card)`
  background: ${({ theme }) => theme.colors.background[1]};
  box-shadow: 0px 0px 24px -6px #0F1011;
  padding: 20px;
`;

export const SectionDescription = styled(Text)`
  margin-bottom: 20px;
`;

interface SectionTitleProps {
  title: string;
  tooltip?: string;
}

export const SectionTitle = ({ title, tooltip }: SectionTitleProps) => (
  <Group gap={6} align='center' mb={12}>
    <Title order={3}>{title}</Title>
    {tooltip && (
      <Tooltip label={tooltip} withArrow color='dark' w={260} multiline arrowSize={8}>
        <Info size={14} style={{ cursor: 'pointer', opacity: 0.7 }} />
      </Tooltip>
    )}
  </Group>
);

interface CollapsibleSectionProps {
  title: string;
  tooltip?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection = ({ title, tooltip, defaultOpen = true, children }: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Section>
      <Header>
        <HeaderButton onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Chevron $open={open}>
            <ChevronDown size={20} />
          </Chevron>
          <Title order={3}>{title}</Title>
        </HeaderButton>
        {tooltip && (
          <Tooltip label={tooltip} withArrow color='dark' w={260} multiline arrowSize={8}>
            <Info size={14} style={{ cursor: 'pointer', opacity: 0.7 }} />
          </Tooltip>
        )}
      </Header>
      <Collapse expanded={open}>
        <Content>{children}</Content>
      </Collapse>
    </Section>
  );
};

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const HeaderButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
`;

const Chevron = styled.span<{ $open: boolean }>`
  display: flex;
  align-items: center;
  transition: transform 150ms ease;
  transform: rotate(${({ $open }) => ($open ? '0deg' : '-90deg')});
`;

const Content = styled.div`
  margin-top: 12px;
`;
