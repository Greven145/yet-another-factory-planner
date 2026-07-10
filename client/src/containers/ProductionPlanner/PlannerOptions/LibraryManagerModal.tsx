// The factory-library manager: bulk-export selected factories to a .json file and
// import factories from a file (drag-drop or browse). Opened from the FactorySwitcher
// "⋯" menu. Import adds factories as new copies (fresh ids) via lib.importFactory.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Stack, Button, Text, Alert } from '@mantine/core';
import { Download, Upload } from 'react-feather';
import { useLibraryContext } from '../../../contexts/library';
import { GameData } from '../../../contexts/gameData/types';
import { labelOf, relativeTime } from '../../../utilities/factory-label';
import { downloadFactories, parseBundle, ImportableFactory } from '../../../utilities/factory-io';
import { FactorySelectList, SelectRow } from './FactorySelectList';
import { useRowSelection } from './useRowSelection';

type ImportResult = { added: number; warnings: string[]; errors: string[] };

const emptyResult = (): ImportResult => ({ added: 0, warnings: [], errors: [] });

export const LibraryManagerModal = ({
  opened,
  onClose,
  gameData,
}: {
  opened: boolean;
  onClose: () => void;
  gameData: GameData;
}) => {
  const lib = useLibraryContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const { selected, setSelected, toggle } = useRowSelection();
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (opened) { setSelected(new Set()); setResult(null); }
  }, [opened, setSelected]);

  const chosen = lib.factories.filter((f) => selected.has(f.id));

  const rows: SelectRow[] = lib.factories.map((f) => ({
    id: f.id,
    label: labelOf(f, gameData),
    meta: `v${f.gameVersion} · ${relativeTime(f.updatedAt)}`,
    isActive: f.id === lib.activeId,
  }));

  const importFiles = async (files: FileList | File[] | null | undefined) => {
    if (!files || Array.from(files).length === 0) return;
    const res = emptyResult();
    // Collect every valid factory across all dropped files, then commit them in a
    // single importFactories call — per-file/per-factory calls would clobber each
    // other (each closes over stale library state).
    const toImport: ImportableFactory[] = [];
    for (const file of Array.from(files)) {
      let raw: string;
      try {
        raw = await file.text();
      } catch {
        res.errors.push(`${file.name}: could not read file.`);
        continue;
      }
      const parsed = parseBundle(raw);
      if (!parsed.ok) {
        res.errors.push(`${file.name}: ${parsed.error}`);
        continue;
      }
      res.warnings.push(...parsed.warnings);
      toImport.push(...parsed.factories);
    }
    lib.importFactories(toImport);
    res.added = toImport.length;
    setResult(res);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Factory library" size="lg" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">{lib.factories.length} {lib.factories.length === 1 ? 'factory' : 'factories'}</Text>

        <FactorySelectList
          rows={rows}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() => setSelected(new Set(lib.factories.map((f) => f.id)))}
        />

        <Button
          leftSection={<Download size={16} />}
          disabled={!chosen.length}
          onClick={() => downloadFactories(chosen)}
        >
          Export {chosen.length ? `${chosen.length} selected` : 'selected'}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { void importFiles(e.target.files); e.target.value = ''; }}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void importFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Import factories from a file"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          style={{
            border: `2px dashed ${dragging ? 'var(--mantine-color-blue-5)' : 'var(--yafp-graph-border)'}`,
            background: dragging ? 'var(--mantine-color-blue-light)' : 'transparent',
            borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer',
          }}
        >
          <Upload size={18} style={{ opacity: 0.7 }} />
          <Text size="sm" mt={4}>Drop a .json file here, or click to browse</Text>
          <Text size="xs" c="dimmed">Imported factories are added as new copies</Text>
        </div>

        {result && (
          <Alert
            color={result.errors.length ? 'red' : 'green'}
            withCloseButton
            onClose={() => setResult(null)}
            title={result.added ? `Imported ${result.added} ${result.added === 1 ? 'factory' : 'factories'}` : 'Nothing imported'}
          >
            <Stack gap={2}>
              {result.errors.map((e, i) => <Text key={`e${i}`} size="sm">⛔ {e}</Text>)}
              {result.warnings.map((w, i) => <Text key={`w${i}`} size="sm" c="yellow.7">⚠ {w}</Text>)}
            </Stack>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
};
