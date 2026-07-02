// The mobile shell's slim orange top bar: logo + the active factory name (taps to
// open the factory bottom sheet) + a "⋮" overflow menu holding the controls that
// live in the desktop SiteHeader (game version, theme toggle, GitHub link).
import React from 'react';
import styled from 'styled-components';
import {
  Menu, ActionIcon, Select, Group,
  useMantineColorScheme, useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MoreVertical, Sun, Moon, GitHub, ChevronDown } from 'react-feather';
import logo from '../../../assets/satisfactory_logo_full_color_small.png';
import ExperimentalModal, { FlaskIcon } from '../../Main/SiteHeader/ExperimentalModal';
import { useGameDataContext } from '../../../contexts/gameData';
import { useLibraryContext } from '../../../contexts/library';
import { useProductionContext } from '../../../contexts/production';
import { labelOf } from '../../../utilities/factory-label';
import { DEFAULT_GAME_VERSION, GAME_VERSION_OPTIONS } from '../../../contexts/gameData/consts';

const ORANGE = '#b0581a';

// The display name of the active factory (nickname or derived label), mirroring
// the label the FactorySwitcher shows for the active tab.
export const useActiveFactoryName = () => {
  const lib = useLibraryContext();
  const ctx = useProductionContext();
  return lib.activeFactory ? labelOf(lib.activeFactory, ctx.gameData) : 'Factory';
};

// Game version + theme + GitHub, tucked behind a "⋮" — the slim-bar overflow.
const OverflowMenu = () => {
  const gd = useGameDataContext();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');
  const [experimentalOpened, { open: openExperimental, close: closeExperimental }] = useDisclosure(false);
  return (
    <>
    <Menu position="bottom-end" withArrow shadow="md" closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon variant="transparent" color="white" size="lg" aria-label="More options">
          <MoreVertical size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Game version</Menu.Label>
        <MenuSelectWrap>
          <Select
            aria-label="Game version"
            data={GAME_VERSION_OPTIONS}
            value={gd.gameVersion}
            onChange={(v) => gd.setGameVersion(v || DEFAULT_GAME_VERSION)}
            disabled={gd.loading}
            comboboxProps={{ withinPortal: false }}
          />
        </MenuSelectWrap>
        <Menu.Divider />
        <Menu.Item
          leftSection={scheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        >
          {scheme === 'dark' ? 'Light theme' : 'Dark theme'}
        </Menu.Item>
        <Menu.Item
          leftSection={<GitHub size={16} />}
          component="a"
          href="https://github.com/greven145/yet-another-factory-planner"
          target="_blank"
        >
          View source
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<FlaskIcon size={16} />} onClick={openExperimental}>
          Experimental features…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
    <ExperimentalModal opened={experimentalOpened} onClose={closeExperimental} />
    </>
  );
};

type Props = {
  onOpenFactories: () => void;
};

const MobileTopBar = ({ onOpenFactories }: Props) => {
  const name = useActiveFactoryName();
  return (
    <Bar h={48} px="sm" gap="xs" wrap="nowrap">
      <img src={logo} height={26} alt="Satisfactory" />
      <FactoryButton type="button" onClick={onOpenFactories} aria-label={`Factories — current: ${name}`}>
        <FactoryName>{name}</FactoryName>
        <ChevronWrap><ChevronDown size={16} /></ChevronWrap>
      </FactoryButton>
      <OverflowMenu />
    </Bar>
  );
};

export default MobileTopBar;

const Bar = styled(Group)`
  flex: 0 0 auto;
  background: ${ORANGE};
  /* Sit below the notch on notched phones (paired with viewport-fit=cover). */
  padding-top: env(safe-area-inset-top);
`;

const FactoryButton = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.18);
  border: none;
  border-radius: 6px;
  color: #fff;
  padding: 6px 10px;
  cursor: pointer;
  overflow: hidden;
`;

const FactoryName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
`;

const ChevronWrap = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
`;

const MenuSelectWrap = styled.div`
  padding: 4px 12px 8px;
`;
