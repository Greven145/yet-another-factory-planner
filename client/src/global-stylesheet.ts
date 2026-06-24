import { createGlobalStyle } from "styled-components";
import bgImage from './assets/stripe-bg.png';

const GlobalStylesheet = createGlobalStyle<any>`
  :root {
    --yafp-body-bg: #26282b;
    --yafp-container-bg: #373b40;
    --yafp-drawer-bg: #26282b;
    --yafp-graph-border: rgba(255, 255, 255, 0.15);
    --yafp-dimmer-opacity: 0.7;
    --yafp-scrollbar-track: #212226;
    --yafp-scrollbar-thumb: #6c6c73;
  }

  :root[data-mantine-color-scheme="dark"] {
    --yafp-body-bg: #26282b;
    --yafp-container-bg: #373b40;
    --yafp-drawer-bg: #26282b;
    --yafp-graph-border: rgba(255, 255, 255, 0.15);
    --yafp-dimmer-opacity: 0.7;
    --yafp-scrollbar-track: #212226;
    --yafp-scrollbar-thumb: #6c6c73;
  }

  :root[data-mantine-color-scheme="light"] {
    --yafp-body-bg: #ede8e1;
    --yafp-container-bg: #f0f2f5;
    --yafp-drawer-bg: #e8e2da;
    --yafp-graph-border: rgba(0, 0, 0, 0.15);
    --yafp-dimmer-opacity: 0.35;
    --yafp-scrollbar-track: #ddd8d0;
    --yafp-scrollbar-thumb: #a89888;
  }

  // Stripe bg image is designed for dark mode — hide it in light mode
  :root[data-mantine-color-scheme="light"] body {
    background-image: none !important;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: ${({ theme }) => theme.fontFamily};
    background: var(--yafp-body-bg) url(${bgImage}) !important;
  }

  #root {
    min-height: 100vh;
  }

  .mantine-Button-root[data-disabled] {
    background-color: var(--button-bg, var(--mantine-primary-color-filled)) !important;
    opacity: 0.65;
  }

  // Mantine v8 outline tabs hardcode dark[6] (#26282b) as the tab button background.
  // Override both background and text for light mode.
  :root[data-mantine-color-scheme="light"] button[role="tab"] {
    background-color: #f8f9fa !important;
    color: #212529 !important;
  }

  :root[data-mantine-color-scheme="light"] button[role="tab"][data-active] {
    background-color: #ffffff !important;
  }

  // Active tab in dark mode gets an orange primary background; ensure text is
  // pure white (not the theme's #eee "white") so contrast meets 4.5:1.
  :root[data-mantine-color-scheme="dark"] button[role="tab"][data-active] {
    color: #ffffff !important;
  }

  // Tabs supply their own backgrounds (above); keep the list strip transparent
  // so it doesn't paint a block to the right of the tabs.
  :root[data-mantine-color-scheme="light"] [role="tablist"] {
    background-color: transparent !important;
  }

  :root[data-mantine-color-scheme="light"] [role="tabpanel"] {
    background: #f0f2f5 !important;
  }

  // Segmented HUD toggle: a tab strip styled like a machine view-mode selector
  // (steel track, active segment filled FICSIT orange, monospace uppercase).
  // Scoped to .segmented-tabs and placed after the generic tab rules above so it
  // overrides them for opted-in strips only; other tabs keep the rules above.
  // Add .segmented-tabs-grow for a full-width strip with equal segments.
  :root .segmented-tabs [role="tablist"] {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 16px;
    border-radius: 6px;
    border: 1px solid light-dark(#cfc9bf, #50565e) !important;
    background-color: light-dark(#e3e1da, #2b2e33) !important;
  }

  :root .segmented-tabs button[role="tab"] {
    font-family: 'M PLUS 1 Code', monospace !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 13px !important;
    font-weight: 600;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 7px 18px !important;
    border: none !important;
    border-radius: 4px !important;
    color: light-dark(#666058, #b0a89c) !important;
    background-color: transparent !important;
    transition: background-color 120ms ease, color 120ms ease;
  }

  :root .segmented-tabs button[role="tab"]:hover {
    background-color: light-dark(#d8d4cb, #3a3e44) !important;
    color: light-dark(#3f3a32, #ece6dc) !important;
  }

  :root .segmented-tabs button[role="tab"][data-active],
  :root .segmented-tabs button[role="tab"][data-active]:hover {
    background-color: #b0581a !important;
    color: #ffffff !important;
  }

  // Full-width variant: the track fills its container and segments share it equally.
  :root .segmented-tabs-grow [role="tablist"] {
    display: flex;
  }

  :root .segmented-tabs-grow button[role="tab"] {
    flex: 1 1 0;
    justify-content: center;
  }

  // HUD-themed Mantine SegmentedControl: same steel track / FICSIT-orange active
  // segment / monospace uppercase language as the segmented tabs above, but for a
  // SegmentedControl (which has its own sliding indicator instead of tab buttons).
  :root .hud-segmented {
    padding: 4px;
    border-radius: 6px;
    border: 1px solid light-dark(#cfc9bf, #50565e) !important;
    background-color: light-dark(#e3e1da, #2b2e33) !important;
  }

  :root .hud-segmented .mantine-SegmentedControl-indicator {
    border-radius: 4px !important;
    box-shadow: none !important;
    background-color: #b0581a !important;
  }

  // Hide the divider Mantine draws between inactive segments.
  :root .hud-segmented .mantine-SegmentedControl-control::before {
    background-color: transparent !important;
  }

  :root .hud-segmented .mantine-SegmentedControl-label {
    font-family: 'M PLUS 1 Code', monospace !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    padding: 5px 16px;
    color: light-dark(#666058, #b0a89c) !important;
    transition: color 120ms ease;
  }

  :root .hud-segmented .mantine-SegmentedControl-label[data-active] {
    color: #ffffff !important;
  }

  html,
  .custom-scrollbar {
    scrollbar-color: var(--yafp-scrollbar-thumb) var(--yafp-scrollbar-track);

    & > * {
      scrollbar-color: initial; // prevent inheritance
    }

    ::-webkit-scrollbar {
      width: auto;
    }

    ::-webkit-scrollbar-track {
      background-color: var(--yafp-scrollbar-track);
    }

    ::-webkit-scrollbar-thumb {
      background-color: var(--yafp-scrollbar-thumb);
    }

    ::-webkit-scrollbar-corner {
      background-color: var(--yafp-scrollbar-track);
    }

    ::-webkit-scrollbar-button:single-button {
      background-color: var(--yafp-scrollbar-track);
      display: block;
      height: auto;
      width: auto;
      background-size: 10px;
      background-repeat: no-repeat;
      background-position: center center;
    }

    // Up
    ::-webkit-scrollbar-button:single-button:vertical:decrement {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#eee"><polygon points="50,20 100,75 0,75 Z"/></svg>')}");
    }

    // Down
    ::-webkit-scrollbar-button:single-button:vertical:increment {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#eee"><polygon points="50,75 100,20 0,20 Z"/></svg>')}");
    }

    // Left
    ::-webkit-scrollbar-button:single-button:horizontal:decrement {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#eee"><polygon points="20,50 75,100 75,0 Z"/></svg>')}");
    }

    // Right
    ::-webkit-scrollbar-button:single-button:horizontal:increment {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#eee"><polygon points="75,50 20,100 20,0 Z"/></svg>')}");
    }
  }

  // Light theme: override scrollbar arrows with dark versions (#eee is invisible on light track)
  :root[data-mantine-color-scheme="light"] {
    &::-webkit-scrollbar-button:single-button:vertical:decrement {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#666"><polygon points="50,20 100,75 0,75 Z"/></svg>')}");
    }
    &::-webkit-scrollbar-button:single-button:vertical:increment {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#666"><polygon points="50,75 100,20 0,20 Z"/></svg>')}");
    }
    &::-webkit-scrollbar-button:single-button:horizontal:decrement {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#666"><polygon points="20,50 75,100 75,0 Z"/></svg>')}");
    }
    &::-webkit-scrollbar-button:single-button:horizontal:increment {
      background-image: url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="#666"><polygon points="75,50 20,100 20,0 Z"/></svg>')}");
    }
  }
`;

export default GlobalStylesheet;
