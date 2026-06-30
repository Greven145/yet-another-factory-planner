// The mobile shell's primary navigation: a two-item bottom bar that flips the
// shell between configuring a factory and viewing its results. Rendered only
// below MOBILE_BREAKPOINT (see ProductionPlanner/index.tsx); desktop keeps the
// drawer + main-content layout untouched.
import React from 'react';
import styled from 'styled-components';
import { Sliders, BarChart2 } from 'react-feather';

export type MobileMode = 'configure' | 'results';

type NavItem = { mode: MobileMode; label: string; icon: React.ReactNode };

const ITEMS: NavItem[] = [
  { mode: 'configure', label: 'Configure', icon: <Sliders size={20} /> },
  { mode: 'results', label: 'Results', icon: <BarChart2 size={20} /> },
];

type Props = {
  mode: MobileMode;
  onChange: (mode: MobileMode) => void;
};

const BottomNav = ({ mode, onChange }: Props) => (
  <Nav aria-label="Mobile views">
    {ITEMS.map((item) => {
      const active = item.mode === mode;
      return (
        <NavButton
          key={item.mode}
          type="button"
          $active={active}
          aria-current={active ? 'page' : undefined}
          onClick={() => onChange(item.mode)}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavButton>
      );
    })}
  </Nav>
);

export default BottomNav;

const Nav = styled.nav`
  flex: 0 0 auto;
  display: flex;
  background: var(--yafp-container-bg);
  border-top: 1px solid var(--yafp-graph-border);
  /* Keep the bar clear of the home indicator on notched phones; the index.html
     viewport-fit=cover lets the inset resolve to a real value there. */
  padding-bottom: env(safe-area-inset-bottom);
`;

// ≥44px tap target (min-height 56px well clears it) per the mobile a11y bar.
const NavButton = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: 8px 0;
  background: transparent;
  border: none;
  /* Active accent: the bright primary-5 orange clears WCAG AA on the dark
     container, but only a darker primary (primary-7) clears 4.5:1 on the light
     container bg — so pick per scheme via light-dark(). */
  border-top: 2px solid ${({ $active }) => ($active ? 'light-dark(var(--mantine-color-primary-7), var(--mantine-color-primary-5))' : 'transparent')};
  cursor: pointer;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 400)};
  color: ${({ $active }) => ($active ? 'light-dark(var(--mantine-color-primary-7), var(--mantine-color-primary-5))' : 'var(--mantine-color-text)')};
`;
