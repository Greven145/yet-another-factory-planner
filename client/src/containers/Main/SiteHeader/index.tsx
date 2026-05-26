import React from 'react';
import styled from 'styled-components';
import { Title, Container, Group, Select, ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import logo from '../../../assets/satisfactory_logo_full_color_small.png';
import SocialIcon from '../../../components/SocialIcon';
import { DEFAULT_GAME_VERSION, GAME_VERSION_OPTIONS } from '../../../contexts/gameData/consts';
import { useGameDataContext } from '../../../contexts/gameData';

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SiteHeader = () => {
  const ctx = useGameDataContext();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <HeaderContainer fluid>
      <img src={logo} height={42} alt='Satisfactory logo' />
      <MainTitle>[Another... Yet Another Factory Planner]</MainTitle>
      <RightAlign>
        <Select
          aria-label="Game version"
          data={GAME_VERSION_OPTIONS}
          value={ctx.gameVersion}
          onChange={(value) => { ctx.setGameVersion(value || DEFAULT_GAME_VERSION); }}
          disabled={ctx.loading}
          style={{ width: '200px' }}
        />
        <ActionIcon
          onClick={toggleColorScheme}
          variant="transparent"
          size="lg"
          aria-label="Toggle color scheme"
          color="white"
        >
          {computedColorScheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </ActionIcon>
        <SocialIcon href='https://github.com/greven145/yet-another-factory-planner' icon={<FontAwesomeIcon icon={faGithub} fontSize={32} />} />
      </RightAlign>
    </HeaderContainer>
  );
};

export default SiteHeader;

const HeaderContainer = styled(Container)`
  display: flex;
  margin-left: ${({ theme }) => theme.other.pageLeftMargin};
  padding: 0px;
`;

const MainTitle = styled(Title)`
  position: relative;
  top: 1px;
  font-size: 32px;
  color: #fff;
  margin-left: 25px;
  white-space: nowrap;
  font-family: 'Indie Flower', sans-serif;
`;

const RightAlign = styled(Group)`
  display: flex;
  margin-left: auto;
  margin-right: 30px;
`;
