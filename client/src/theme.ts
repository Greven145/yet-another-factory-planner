import { MantineThemeOverride } from '@mantine/core';
// import { gradientFromColor } from './utilities/color';

const defaultFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

const baseSat = '77%';
const baseLight = '63%';
const selectSat = '58%';
const selectLight = '58%';


export const graphColors = {
  // nodes
  resource: { base: `hsl(31, ${baseSat}, ${baseLight})`, selected: `hsl(31, ${selectSat}, ${selectLight})` },
  input: { base: `hsl(0, ${baseSat}, ${baseLight})`, selected: `hsl(0, ${selectSat}, ${selectLight})` },
  handGathered: { base: `hsl(261, ${baseSat}, ${baseLight})`, selected: `hsl(261, ${selectSat}, ${selectLight})` },
  sideProduct: { base: `hsl(311, ${baseSat}, ${baseLight})`, selected: `hsl(311, ${selectSat}, ${selectLight})` },
  finalProduct: { base: `hsl(128, ${baseSat}, ${baseLight})`, selected: `hsl(128, ${selectSat}, ${selectLight})` },
  recipe: { base: `hsl(197, ${baseSat}, ${baseLight})`, selected: `hsl(197, ${selectSat}, ${selectLight})` },
  nuclear: { base: `hsl(50, ${baseSat}, ${baseLight})`, selected: `hsl(50, ${selectSat}, ${selectLight})` },

  // edges
  edge: { line: '#999999', label: '#eeeeee' },
  incoming: { line: `hsl(31, ${baseSat}, ${baseLight})`, label: `hsl(31, ${baseSat}, ${baseLight})` },
  outgoing: { line: `hsl(128, ${baseSat}, ${baseLight})`, label: `hsl(128, ${baseSat}, ${baseLight})` },
}

export const theme: MantineThemeOverride = {
  primaryColor: 'primary',
  colors: {
    'primary': ["#fcebde", "#f9d8be", "#f7c59f", "#f4b17f", "#f19e60", "#ef8b40", "#ec7821", "#c4631c", "#94501e", "#673c1c"],
    'positive': ["#e9f3ea", "#d5e8d6", "#c1ddc2", "#acd2ae", "#98c69a", "#83bb86", "#6fb072", "#58965c", "#49744b", "#39543a"],
    'danger': ["#fdb5b5", "#fda3a3", "#fc9191", "#fc7e7e", "#fb6c6c", "#fa5959", "#fa4747", "#f12929", "#dc1818", "#b21b1b"],
    'background': ["#26282b", "#373b40", "#3f434a", "#50565e", "#6c7582", "#ffffff", "#ffffff", "#ffffff", "#b3b6ba", "#ffffff"],
    'info': Array(10).fill('#3065c7') as any,
  },
  white: '#eee',
  fontFamily: defaultFont,
  radius: { xs: 0, sm: 2, md: 4, lg: 8, xl: 16 },
  headings: {
    fontFamily: defaultFont,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '36px', lineHeight: '1.3' },
      h2: { fontSize: '30px', lineHeight: '1.35' },
      h3: { fontSize: '22px', lineHeight: '1.4' },
      h4: { fontSize: '18px', lineHeight: '1.45' },
      h5: { fontSize: '16px', lineHeight: '1.5' },
      h6: { fontSize: '14px', lineHeight: '1.5' },
    }
  },
  other: {
    headerHeight: '64px',
    pageLeftMargin: '55px',
    drawerWidth: '620px',
    drawerZIndex: '10',
    tooltipZIndex: '9999',
  },
  components: {
    AppShell: {
      styles: {
        root: { minHeight: '100vh' },
        header: { background: '#ec7821', borderBottom: 'none', padding: '10px', overflow: 'hidden' },
        main: { background: 'transparent', paddingTop: '80px' },
      },
    },
    Paper: {
      styles: {
        root: { background: 'light-dark(#ffffff, #373b40)', padding: '15px' },
      },
    },
    Text: {
      styles: {
        root: { color: 'light-dark(#212529, #eee)' },
      },
    },
    Title: {
      styles: {
        root: { color: 'light-dark(#212529, #eee)' },
      },
    },
    Select: {
      styles: {
        label: { color: 'light-dark(#212529, #eee)' },
      },
    },
    TextInput: {
      styles: {
        label: { color: 'light-dark(#212529, #eee)' },
      },
    },
    Checkbox: {
      styles: {
        label: { cursor: 'pointer', color: 'light-dark(#212529, #eee)' },
        input: { cursor: 'pointer' },
      },
    },
    Switch: {
      styles: {
        label: { cursor: 'pointer', color: 'light-dark(#212529, #eee)' },
      },
    },
    Divider: {
      styles: {
        root: { borderTopColor: 'light-dark(#dee2e6, #50565e)' },
      },
    },
    Button: {
      styles: {
        root: { color: '#fff' },
      },
    },
    Tabs: {
      styles: {
        root: {
          '--mantine-color-body': 'light-dark(#f8f9fa, #373b40)',
        },
        tab: {
          color: 'light-dark(#212529, #eee)',
          fontFamily: "'M PLUS 1 Code', sans-serif",
          fontSize: '16px',
          '--tab-border-color': 'light-dark(#aaa, #fff)',
          marginBottom: '-1px',
          position: 'relative',
          zIndex: 1,
          justifyContent: 'center',
        },
        tabLabel: {
          flex: '0 1 auto',
        },
        list: {
          borderBottom: 'calc(0.0625rem * var(--mantine-scale)) solid light-dark(#aaa, #fff)',
        },
        panel: {
          paddingTop: '0px',
          background: 'light-dark(#f0f2f5, #26282b)',
          borderBottomLeftRadius: '2px',
          borderBottomRightRadius: '2px',
        },
      },
    },
    Tooltip: {
      styles: {
        tooltip: {
          background: 'light-dark(#fff, #3f434a)',
          border: '1px solid light-dark(#ccc, #aaa)',
        },
      },
    },
    Popover: {
      styles: {
        dropdown: {
          background: 'light-dark(#fff, #3f434a)',
          borderColor: 'light-dark(#ccc, #aaa)',
        },
      },
    },
  },
};

