import { nfseStyles } from './nfse-styles';

type Style = {
  fontSize?: number;
  bold?: boolean;
  fillColor?: string;
  margin?: [number, number, number, number];
  lineHeight?: number;
};

function isTuple4Numbers(m: unknown): m is [number, number, number, number] {
  return (
    Array.isArray(m) && m.length === 4 && m.every((v) => typeof v === 'number')
  );
}

describe('nfseStyles', () => {
  it('should export all expected style keys', () => {
    const keys = Object.keys(nfseStyles).sort();
    expect(keys).toEqual(
      [
        'title',
        'titleSmall',
        'sectionHeader',
        'th',
        'td',
        'td2',
        'boxLabel',
        'boxValue',
      ].sort(),
    );
  });

  it('should define "title" correctly', () => {
    const s: Style = nfseStyles.title;
    expect(s).toEqual({ fontSize: 14, bold: true });
  });

  it('should define "titleSmall" correctly', () => {
    const s: Style = nfseStyles.titleSmall;
    expect(s).toEqual({ fontSize: 12, bold: true });
  });

  it('should define "sectionHeader" correctly', () => {
    const s: Style = nfseStyles.sectionHeader;
    expect(s.bold).toBe(true);
    expect(s.fillColor).toBe('#eeeeee');
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 4, 0, 4]);
  });

  it('should define "th" correctly', () => {
    const s: Style = nfseStyles.th;
    expect(s.bold).toBe(true);
    expect(s.fillColor).toBe('#dddddd');
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 2, 0, 2]);
  });

  it('should define "td" correctly', () => {
    const s: Style = nfseStyles.td;
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 2, 0, 2]);
  });

  it('should define "td2" correctly', () => {
    const s: Style = nfseStyles.td2;
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 6, 0, 6]);
    expect(s.fontSize).toBe(9);
    expect(s.lineHeight).toBe(1.2);
  });

  it('should define "boxLabel" correctly', () => {
    const s: Style = nfseStyles.boxLabel;
    expect(s.bold).toBe(true);
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 2, 0, 2]);
  });

  it('should define "boxValue" correctly', () => {
    const s: Style = nfseStyles.boxValue;
    expect(isTuple4Numbers(s.margin)).toBe(true);
    expect(s.margin).toEqual([0, 2, 0, 2]);
  });
});
