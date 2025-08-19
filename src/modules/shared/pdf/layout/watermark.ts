import type { Content } from 'pdfmake/interfaces';

export type HeaderFn = (
  currentPage: number,
  pageCount: number,
  pageSize: { width: number; height: number },
) => Content;

export function makeCancelledOverlayHeader(
  text = 'CANCELADA',
  opacity = 0.7,
): HeaderFn {
  return (_cp, _pc, pageSize) => {
    const cx = pageSize.width / 2;
    const cy = pageSize.height / 2;
    const angle = 35;
    const fontSize = 110;
    const fill = '#d32f2f';

    const svg = `
      <svg width="${pageSize.width}" height="${pageSize.height}">
        <g transform="translate(${cx},${cy}) rotate(${angle})">
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
                font-size="${fontSize}" font-family="Helvetica" font-weight="700"
                fill="${fill}" opacity="${opacity}">
            ${text}
          </text>
        </g>
      </svg>`;
    return { svg, absolutePosition: { x: 0, y: 0 } };
  };
}
