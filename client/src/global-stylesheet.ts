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

  :root[data-mantine-color-scheme="light"] [role="tablist"] {
    background-color: #f8f9fa !important;
  }

  :root[data-mantine-color-scheme="light"] [role="tabpanel"] {
    background: #f0f2f5 !important;
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
