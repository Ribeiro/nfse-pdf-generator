import { PdfLayouts } from './layouts';

type Cell = Record<string, unknown>;
type Row = ReadonlyArray<Cell>;
type Body = ReadonlyArray<Row>;

type TableNode = Readonly<{
  table: Readonly<{
    body?: Body;
    widths?: ReadonlyArray<string | number>;
  }>;
}>;

type FnN = (i: number, node: unknown) => number;
type FnS = (i: number, node: unknown) => string;
type CustomLayout = {
  hLineWidth?: FnN;
  vLineWidth?: FnN;
  hLineColor?: FnS;
  vLineColor?: FnS;
  paddingLeft?: FnN;
  paddingRight?: FnN;
  paddingTop?: FnN;
  paddingBottom?: FnN;
};

const makeNode = (
  body?: Body,
  widths?: ReadonlyArray<string | number>,
): TableNode => ({ table: { body, widths } });

describe('PdfLayouts.headerLogo', () => {
  it('exposes expected sizing fields', () => {
    expect(PdfLayouts.headerLogo.colWidth).toBe(100);
    expect(PdfLayouts.headerLogo.maxHeight).toBe(60);
    expect(PdfLayouts.headerLogo.hPadding).toBe(0);
  });
});

describe('PdfLayouts.innerCompact', () => {
  const layout = PdfLayouts.innerCompact as unknown as CustomLayout;

  it('uses 0 hLineWidth on first and last row, 0.5 otherwise', () => {
    const node = makeNode([[{}], [{}], [{}]]);
    expect(layout.hLineWidth?.(0, node)).toBe(0);
    expect(layout.hLineWidth?.(1, node)).toBe(0.5);
    expect(layout.hLineWidth?.(2, node)).toBe(0.5);
    expect(layout.hLineWidth?.(3, node)).toBe(0);
  });

  it('has no vertical lines and compact paddings', () => {
    expect(layout.vLineWidth?.(0, makeNode())).toBe(0);
    expect(layout.hLineColor?.(0, makeNode())).toBe('#E0E0E0');
    expect(layout.paddingLeft?.(0, makeNode())).toBe(4);
    expect(layout.paddingRight?.(0, makeNode())).toBe(4);
    expect(layout.paddingTop?.(0, makeNode())).toBe(1.5);
    expect(layout.paddingBottom?.(0, makeNode())).toBe(1.5);
  });
});

describe('PdfLayouts.header', () => {
  const layout = PdfLayouts.header as unknown as CustomLayout;

  it('draws a horizontal line on top and bottom only', () => {
    const node = makeNode([[{}], [{}]]);
    expect(layout.hLineWidth?.(0, node)).toBe(1);
    expect(layout.hLineWidth?.(1, node)).toBe(0);
    expect(layout.hLineWidth?.(2, node)).toBe(1);
  });

  it('draws vertical lines at i=0, i=cols-1 and i=cols (outer edges)', () => {
    const node = makeNode([[{}, {}]], [100, '*']);
    expect(layout.vLineWidth?.(0, node)).toBe(1);
    expect(layout.vLineWidth?.(1, node)).toBe(1);
    expect(layout.vLineWidth?.(2, node)).toBe(1);
    expect(layout.vLineWidth?.(3, node)).toBe(0);
  });

  it('falls back to body length when widths is missing', () => {
    const node = makeNode([[{}, {}, {}]]);
    expect(layout.vLineWidth?.(0, node)).toBe(1);
    expect(layout.vLineWidth?.(1, node)).toBe(0);
    expect(layout.vLineWidth?.(2, node)).toBe(1);
    expect(layout.vLineWidth?.(3, node)).toBe(1);
  });

  it('applies colors and paddings', () => {
    expect(layout.hLineColor?.(0, makeNode())).toBe('#BFBFBF');
    expect(layout.vLineColor?.(0, makeNode())).toBe('#BFBFBF');
    expect(layout.paddingLeft?.(0, makeNode())).toBe(8);
    expect(layout.paddingRight?.(0, makeNode())).toBe(8);
    expect(layout.paddingTop?.(0, makeNode())).toBe(6);
    expect(layout.paddingBottom?.(0, makeNode())).toBe(6);
  });
});

describe('PdfLayouts.numberInner', () => {
  const layout = PdfLayouts.numberInner as unknown as CustomLayout;

  it('draws a single horizontal line at i=1 only', () => {
    expect(layout.hLineWidth?.(0, makeNode())).toBe(0);
    expect(layout.hLineWidth?.(1, makeNode())).toBe(1);
    expect(layout.hLineWidth?.(2, makeNode())).toBe(0);
  });

  it('has no vertical lines and expected style', () => {
    expect(layout.vLineWidth?.(0, makeNode())).toBe(0);
    expect(layout.hLineColor?.(0, makeNode())).toBe('#BFBFBF');
    expect(layout.paddingLeft?.(0, makeNode())).toBe(6);
    expect(layout.paddingRight?.(0, makeNode())).toBe(6);
    expect(layout.paddingTop?.(0, makeNode())).toBe(5);
    expect(layout.paddingBottom?.(0, makeNode())).toBe(5);
  });
});

describe('PdfLayouts.outerBox', () => {
  const layout = PdfLayouts.outerBox as unknown as CustomLayout;

  it('draws outer horizontal border on first and last, none inside', () => {
    const node = makeNode([[{}], [{}], [{}]]);
    expect(layout.hLineWidth?.(0, node)).toBe(1);
    expect(layout.hLineWidth?.(1, node)).toBe(0);
    expect(layout.hLineWidth?.(2, node)).toBe(0);
    expect(layout.hLineWidth?.(3, node)).toBe(1);
  });

  it('draws outer vertical border on first and last columns, none inside', () => {
    const node = makeNode([[{}, {}, {}]], [100, '*', 50]);
    expect(layout.vLineWidth?.(0, node)).toBe(1);
    expect(layout.vLineWidth?.(1, node)).toBe(0);
    expect(layout.vLineWidth?.(2, node)).toBe(0);
    expect(layout.vLineWidth?.(3, node)).toBe(1);
  });

  it('applies colors and paddings', () => {
    expect(layout.hLineColor?.(0, makeNode())).toBe('#BFBFBF');
    expect(layout.vLineColor?.(0, makeNode())).toBe('#BFBFBF');
    expect(layout.paddingLeft?.(0, makeNode())).toBe(8);
    expect(layout.paddingRight?.(0, makeNode())).toBe(8);
    expect(layout.paddingTop?.(0, makeNode())).toBe(6);
    expect(layout.paddingBottom?.(0, makeNode())).toBe(6);
  });
});

describe('PdfLayouts.gridNoOuter', () => {
  const layout = PdfLayouts.gridNoOuter as unknown as CustomLayout;

  it('draws no outer horizontal line but draws inner ones', () => {
    const node = makeNode([[{}], [{}], [{}]]);
    expect(layout.hLineWidth?.(0, node)).toBe(0);
    expect(layout.hLineWidth?.(1, node)).toBe(1);
    expect(layout.hLineWidth?.(2, node)).toBe(1);
    expect(layout.hLineWidth?.(3, node)).toBe(0);
  });

  it('draws no outer vertical line but draws inner ones', () => {
    const node = makeNode([[{}, {}, {}]], [100, '*', 50]);
    expect(layout.vLineWidth?.(0, node)).toBe(0);
    expect(layout.vLineWidth?.(1, node)).toBe(1);
    expect(layout.vLineWidth?.(2, node)).toBe(1);
    expect(layout.vLineWidth?.(3, node)).toBe(0);
  });

  it('uses light grid colors', () => {
    expect(layout.hLineColor?.(0, makeNode())).toBe('#E0E0E0');
    expect(layout.vLineColor?.(0, makeNode())).toBe('#E0E0E0');
  });
});

describe('edge cases for column/row inference', () => {
  it('no widths and empty body -> counts are 0, so only i=0 lines can match', () => {
    const header = PdfLayouts.header as unknown as CustomLayout;
    const outer = PdfLayouts.outerBox as unknown as CustomLayout;
    const grid = PdfLayouts.gridNoOuter as unknown as CustomLayout;

    const node = makeNode();

    expect(header.hLineWidth?.(0, node)).toBe(1);
    expect(header.hLineWidth?.(1, node)).toBe(0);

    expect(header.vLineWidth?.(0, node)).toBe(1);
    expect(header.vLineWidth?.(1, node)).toBe(0);

    expect(outer.hLineWidth?.(0, node)).toBe(1);
    expect(outer.hLineWidth?.(1, node)).toBe(0);
    expect(outer.vLineWidth?.(0, node)).toBe(1);
    expect(outer.vLineWidth?.(1, node)).toBe(0);

    expect(grid.hLineWidth?.(0, node)).toBe(0);
    expect(grid.vLineWidth?.(0, node)).toBe(0);
  });
});
