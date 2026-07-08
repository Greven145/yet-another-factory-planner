import { LibraryFactory } from '../../contexts/library/types';
import { FactoryOptions } from '../../contexts/production/types';

/**
 * The JSON-file contract for exporting/importing factories to disk.
 *
 * This is a SEPARATE contract from the share-link wire format in
 * `shared-factory/codec` (which is number-coerced for the API/URL). A file
 * export keeps the client-shape `config` verbatim so a round-trip through disk
 * needs no game data to decode and is lossless. The envelope is versioned so a
 * future importer can refuse a file it doesn't understand.
 */
export const EXPORT_ENVELOPE_VERSION = 1;
export const EXPORT_APP_NAME = 'yet-another-factory-planner';

// Versions this build ships game data for. Unknown versions still import (the
// factory just may not solve) but are surfaced as a warning.
const KNOWN_VERSIONS = new Set(['1.1', '1.2']);

export type ExportedFactory = {
  id: string;
  nickname?: string;
  gameVersion: string;
  config?: FactoryOptions;
  sourceKey?: string;
};

export type ExportBundle = {
  app: string;
  envelopeVersion: number;
  exportedAt: string;
  factories: ExportedFactory[];
};

// A parsed factory ready to hand to `importFactories`, minus the library-local
// id/timestamps (those are re-minted on import). The nickname IS preserved so an
// imported factory keeps the name the user gave it.
export type ImportableFactory = Pick<ExportedFactory, 'config' | 'gameVersion' | 'nickname' | 'sourceKey'>;

export type ParseResult =
  | { ok: true; factories: ImportableFactory[]; warnings: string[] }
  | { ok: false; error: string };

// ---- Export ---------------------------------------------------------------

export function buildBundle(factories: LibraryFactory[]): ExportBundle {
  return {
    app: EXPORT_APP_NAME,
    envelopeVersion: EXPORT_ENVELOPE_VERSION,
    exportedAt: new Date().toISOString(),
    factories: factories.map((f) => ({
      id: f.id,
      nickname: f.nickname,
      gameVersion: f.gameVersion,
      config: f.config,
      sourceKey: f.sourceKey,
    })),
  };
}

export function serializeBundle(factories: LibraryFactory[]): string {
  return JSON.stringify(buildBundle(factories), null, 2);
}

function exportFilename(factories: LibraryFactory[], label?: string): string {
  if (factories.length === 1) {
    const base = label ?? factories[0].nickname ?? factories[0].id;
    return `factory-${base.replace(/\W+/g, '-').toLowerCase()}.json`;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return `factories-${factories.length}-${stamp}.json`;
}

// Trigger a browser download of the given factories as one .json bundle.
export function downloadFactories(factories: LibraryFactory[], label?: string): void {
  const blob = new Blob([serializeBundle(factories)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename(factories, label);
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Import ---------------------------------------------------------------

// Validate untrusted file text into importable factories. One malformed factory
// is dropped with a warning rather than sinking the whole file; only a
// structurally invalid envelope is a hard error.
export function parseBundle(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }

  if (!json || typeof json !== 'object') return { ok: false, error: 'File is not a factory export.' };
  const b = json as Partial<ExportBundle>;
  if (b.envelopeVersion == null || !Array.isArray(b.factories)) {
    return { ok: false, error: 'Not a factory export file (missing envelope or factories).' };
  }
  if (b.envelopeVersion > EXPORT_ENVELOPE_VERSION) {
    return { ok: false, error: `This file was made by a newer version (v${b.envelopeVersion}). Update the app to import it.` };
  }

  const warnings: string[] = [];
  const factories: ImportableFactory[] = [];
  b.factories.forEach((f, i) => {
    const label = f?.nickname ? `"${f.nickname}"` : `#${i + 1}`;
    if (!f || typeof f !== 'object' || !f.gameVersion) {
      warnings.push(`Factory ${label} has no game version and was skipped.`);
      return;
    }
    if (!KNOWN_VERSIONS.has(f.gameVersion)) {
      warnings.push(`Factory ${label} uses an unknown game version "${f.gameVersion}" and may not solve.`);
    }
    factories.push({ config: f.config, gameVersion: f.gameVersion, nickname: f.nickname, sourceKey: f.sourceKey });
  });

  if (factories.length === 0) return { ok: false, error: 'No importable factories were found in the file.' };
  return { ok: true, factories, warnings };
}
