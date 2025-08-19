import { TableLayout } from '../types';

type LayoutNode = Readonly<{
  table?: Readonly<{
    body?: ReadonlyArray<ReadonlyArray<unknown>>;
    widths?: ReadonlyArray<string | number>;
  }>;
}>;

const is2DArray = (
  val: unknown,
): val is ReadonlyArray<ReadonlyArray<unknown>> =>
  Array.isArray(val) && val.every((r) => Array.isArray(r));

const tableRowsCount = (node: unknown): number => {
  const t = (node as LayoutNode).table;
  const body = t?.body;
  return Array.isArray(body) ? body.length : 0;
};

const tableColsCount = (node: unknown): number => {
  const t = (node as LayoutNode).table;
  const widths = t?.widths;
  if (Array.isArray(widths)) return widths.length;
  const bodyUnknown: unknown = t?.body;
  if (is2DArray(bodyUnknown) && bodyUnknown.length > 0)
    return bodyUnknown[0].length;
  return 0;
};

export const PdfLayouts = {
  innerCompact: {
    hLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableRowsCount(node) ? 0 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => '#E0E0E0',
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 1.5,
    paddingBottom: () => 1.5,
  } as TableLayout,

  header: {
    hLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableRowsCount(node) ? 1 : 0,
    vLineWidth: (i: number, node: unknown) => {
      const cols = tableColsCount(node);
      return i === 0 || i === cols || i === cols - 1 ? 1 : 0;
    },
    hLineColor: () => '#BFBFBF',
    vLineColor: () => '#BFBFBF',
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  } as TableLayout,

  numberInner: {
    hLineWidth: (i: number) => (i === 1 ? 1 : 0),
    vLineWidth: () => 0,
    hLineColor: () => '#BFBFBF',
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  } as TableLayout,

  outerBox: {
    hLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableRowsCount(node) ? 1 : 0,
    vLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableColsCount(node) ? 1 : 0,
    hLineColor: () => '#BFBFBF',
    vLineColor: () => '#BFBFBF',
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  } as TableLayout,

  gridNoOuter: {
    hLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableRowsCount(node) ? 0 : 1,
    vLineWidth: (i: number, node: unknown) =>
      i === 0 || i === tableColsCount(node) ? 0 : 1,
    hLineColor: () => '#E0E0E0',
    vLineColor: () => '#E0E0E0',
  } as TableLayout,

  headerLogo: { colWidth: 100, maxHeight: 60, hPadding: 0 },
};
