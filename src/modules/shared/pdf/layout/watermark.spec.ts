import { Content } from '../types';
import { makeCancelledOverlayHeader, type HeaderFn } from './watermark';

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function isContentWithSvg(x: unknown): x is Content & { svg: string } {
  return isObject(x) && typeof (x as { svg?: unknown }).svg === 'string';
}

describe('makeCancelledOverlayHeader', () => {
  it('returns a HeaderFn', () => {
    const fn = makeCancelledOverlayHeader();
    const typed: HeaderFn = fn;
    expect(typeof typed).toBe('function');
  });

  it('produces a Content with SVG and absolute position using defaults', () => {
    const header = makeCancelledOverlayHeader();
    const pageSize = { width: 595, height: 842 };
    const content: Content = header(1, 10, pageSize);

    expect(isContentWithSvg(content)).toBe(true);
    const svg = (content as { svg: string }).svg;

    expect(svg).toContain(
      `<svg width="${pageSize.width}" height="${pageSize.height}">`,
    );

    const cx = pageSize.width / 2;
    const cy = pageSize.height / 2;
    expect(svg).toContain(`transform="translate(${cx},${cy}) rotate(35)"`);

    expect(svg).toContain(`font-size="110"`);
    expect(svg).toContain(`font-family="Helvetica"`);
    expect(svg).toContain(`font-weight="700"`);
    expect(svg).toContain(`fill="#d32f2f"`);
    expect(svg).toContain(`opacity="0.7"`);

    expect(svg).toContain(`>`);
    expect(svg).toContain(`CANCELADA`);

    const abs = (content as { absolutePosition?: unknown }).absolutePosition as
      | { x: number; y: number }
      | undefined;
    expect(isObject(abs)).toBe(true);
    expect(abs).toEqual({ x: 0, y: 0 });
  });

  it('applies custom text and opacity', () => {
    const header = makeCancelledOverlayHeader('VOID', 0.3);
    const pageSize = { width: 400, height: 200 };
    const content: Content = header(5, 12, pageSize);

    expect(isContentWithSvg(content)).toBe(true);
    const svg = (content as { svg: string }).svg;

    expect(svg).toContain('VOID');
    expect(svg).toContain(`opacity="0.3"`);

    const cx = pageSize.width / 2;
    const cy = pageSize.height / 2;
    expect(svg).toContain(`width="${pageSize.width}"`);
    expect(svg).toContain(`height="${pageSize.height}"`);
    expect(svg).toContain(`transform="translate(${cx},${cy}) rotate(35)"`);
  });

  it('ignores currentPage/pageCount in output (pure function of pageSize & args)', () => {
    const header = makeCancelledOverlayHeader('TEXT', 0.5);
    const pageSize = { width: 300, height: 300 };

    const a = header(1, 2, pageSize) as { svg: string };
    const b = header(99, 999, pageSize) as { svg: string };

    expect(a.svg).toBe(b.svg);
  });
});
