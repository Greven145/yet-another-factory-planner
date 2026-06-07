import { MantineTheme } from '@mantine/core';

declare module 'styled-components' {
  export interface DefaultTheme extends MantineTheme {}
}
