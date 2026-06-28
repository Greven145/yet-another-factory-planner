import { FactoryOptions } from '../production/types';

// A single saved factory in the localStorage library.
export type LibraryFactory = {
  id: string;
  nickname?: string;
  gameVersion: string;
  // Undefined for a freshly-created/just-imported slot: the production reducer
  // initializes it and autosave writes the real config back on first edit.
  config?: FactoryOptions;
  // The share key this factory was imported from, if any (no dedupe in v1).
  sourceKey?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

// The library is a map keyed by factory id.
export type LibraryMap = {
  [id: string]: LibraryFactory;
};
