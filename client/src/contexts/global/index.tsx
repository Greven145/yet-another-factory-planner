import { useLocalStorage } from '@mantine/hooks';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import seedrandom from 'seedrandom';


// TYPE
export type GlobalContextType = {
  ficsitTip: string,
  engineerId: string,
  refreshTip: () => void,
};


// CONTEXT
export const GlobalContext = createContext<GlobalContextType | null>(null);
GlobalContext.displayName = 'GlobalContext';


// HELPER HOOK
export function useGlobalContext() {
  const ctx = useContext(GlobalContext);
  if (!ctx) {
    throw new Error('GlobalContext is null');
  }
  return ctx;
}


const ONE_HOUR = 1000 * 60 * 60;
const TIPS = [
  'Pet the lizard doggo!',
  'Get back to work!',
  'Conveyor belts go brrr!',
  'Arachnophobia mode enabled.',
  'FICSIT does not waste.',
  'Linear programming!',
  'Do not pet the spiders.',
  'Just slap some beams on it!',
  'Just 5 more minutes...',
  'Thanks, Jace. Helps a lot!',
  'Thanks, Snutt. Helps a lot!',
  'Check out the new Spire Coast!',
  'ADA says it\'s my turn to play with the nuke nobelisk.',
  'Harvest.',
  'Spaghetti is a valid strategy.',
  'Overclocking intensifies...',
  'ONE. MORE. EXPANSION.',
  'Space Elevator go whoosh!',
  'Factorio is that way ->',
  'Maximum efficiency achieved!',
  'Time to rearrange the factory.',
  'FICSIT Milestone: COMPLETE!',
  'Feed the factory!',
  'Power? UNLIMITED!',
];

function getTip() {
  const seed = Math.floor(new Date().getTime() / (0.5 * ONE_HOUR));
  const rng = seedrandom(String(seed));
  const index = Math.floor(rng() * TIPS.length);
  return `FICSIT Tip #${index}: ${TIPS[index]}`;
}

function getDefaultId() {
  return Math.floor(Math.random() * 1e7).toString().padStart(7, '0');
}


// PROVIDER
type PropTypes = { children: React.ReactNode };
export const GlobalContextProvider = ({ children }: PropTypes) => {
  const [engineerId] = useLocalStorage<string>({ key: 'engineer-id', defaultValue: getDefaultId() });
  const [tip, setTip] = useState(getTip());

  const refreshTip = useCallback(() => {
    const tip = getTip();
    setTip(tip);
  }, []);
  
  const ctxValue = useMemo(() => {
    return {
      ficsitTip: tip,
      engineerId,
      refreshTip,
    }
  }, [engineerId, refreshTip, tip]);

  return (
    <GlobalContext.Provider value={ctxValue}>
      {children}
    </GlobalContext.Provider>
  );
}
