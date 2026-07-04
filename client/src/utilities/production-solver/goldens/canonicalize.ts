import type { SolverResults, ProductionGraph, GraphEdge, ProducedItemInformation, Report } from '../models';

// Anything with magnitude below this is treated as float noise / a phantom
// near-zero artifact and collapsed to 0 so snapshots don't churn.
const NEAR_ZERO = 1e-9;

// Round a single numeric leaf to 9 significant figures, collapse near-zero
// values to 0, and normalize -0 to 0 so the result is JSON-stable.
export function roundLeaf(v: number): number {
  if (!Number.isFinite(v)) return v;
  if (Math.abs(v) < NEAR_ZERO) return 0;
  const r = Number(v.toPrecision(9));
  return Object.is(r, -0) ? 0 : r;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// edges have no inherent order — sort by (from, to, key) for stability.
function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.key, b.key);
}

// Recursively round numeric leaves and sort object keys. Array order is
// preserved (callers pre-sort arrays that lack inherent order).
function canonValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return roundLeaf(v);
  if (Array.isArray(v)) return v.map(canonValue);
  if (typeof v === 'object') {
    const out: { [k: string]: unknown } = {};
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      out[key] = canonValue((v as Record<string, unknown>)[key]);
    }
    return out;
  }
  return v;
}

function canonGraph(graph: ProductionGraph): unknown {
  return {
    nodes: graph.nodes,
    edges: [...graph.edges].sort(compareEdges),
  };
}

function canonReport(report: Report): unknown {
  return {
    ...report,
    totalItemsRecap: [...report.totalItemsRecap].sort(
      (a: ProducedItemInformation, b: ProducedItemInformation) => cmp(a.key, b.key),
    ),
  };
}

// Produce a deterministic, float-noise-tolerant, JSON-serializable view of a
// solver result: wall-clock fields dropped, errors flattened, numbers rounded,
// keys sorted, order-less arrays sorted. Pure and idempotent through a JSON
// roundtrip.
export function canonicalize(results: SolverResults): unknown {
  const productionGraph = results.productionGraph === null
    ? null
    : canonGraph(results.productionGraph);

  const report = results.report === null
    ? null
    : canonReport(results.report);

  const error = results.error === null
    ? null
    : {
        name: results.error.name,
        message: results.error.message,
        helpText: results.error.helpText ?? null,
      };

  return canonValue({ error, productionGraph, report });
}
