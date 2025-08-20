/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
jest.mock('./nfse-styles', () => ({
  nfseStyles: { __token: 'STYLES' },
}));

jest.mock('./asset-loader', () => {
  const fakeAssets = {
    preload: jest.fn().mockResolvedValue(undefined),
    loadMunicipioLogoDataUrl: jest
      .fn()
      .mockReturnValue('data:image/png;base64,AAA'),
    loadBrandLogoDataUrl: jest
      .fn()
      .mockReturnValue('data:image/png;base64,BBB'),
  };
  const fakeMunicipios = {
    preload: jest.fn().mockResolvedValue(undefined),
    resolveName: jest.fn().mockResolvedValue('São Paulo'),
    clearCache: jest.fn(),
  };

  const createNfseInfraFromEnv = jest.fn().mockResolvedValue({
    assets: fakeAssets,
    municipios: fakeMunicipios,
  });

  return {
    __esModule: true,
    createNfseInfraFromEnv,
    __test__: { fakeAssets, fakeMunicipios },
  };
});

jest.mock('./nfse-sections', () => {
  const headerMock = jest.fn().mockReturnValue({ sec: 'HEADER' });
  const metaMock = jest.fn().mockReturnValue({ sec: 'META' });
  const prestadorMock = jest.fn().mockReturnValue({ sec: 'PRESTADOR' });
  const tomadorMock = jest.fn().mockReturnValue({ sec: 'TOMADOR' });
  const discriminacaoMock = jest.fn().mockReturnValue({ sec: 'DISCRIMINACAO' });
  const valoresMock = jest.fn().mockReturnValue({ sec: 'VALORES' });
  const avisosMock = jest.fn().mockReturnValue({ sec: 'AVISOS' });

  class NfseSections {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_assetLoader: unknown) {
      /* no-op */
    }
    header = headerMock;
    meta = metaMock;
    prestador = prestadorMock;
    tomador = tomadorMock;
    discriminacao = discriminacaoMock;
    valores = valoresMock;
    avisos = avisosMock;
  }

  return {
    __esModule: true,
    NfseSections,
    headerMock,
    metaMock,
    prestadorMock,
    tomadorMock,
    discriminacaoMock,
    valoresMock,
    avisosMock,
  };
});

jest.mock('./qr.service', () => {
  const buildQrValueMock = jest.fn().mockReturnValue('QRVALUE');
  class NfseQrService {
    buildQrValue = buildQrValueMock;
  }
  return { __esModule: true, NfseQrService, buildQrValueMock };
});

jest.mock('./watermark', () => {
  const makeCancelledOverlayHeader = jest.fn(() => ({ text: 'CANCELLED' }));
  return { __esModule: true, makeCancelledOverlayHeader };
});

import { NfseLayoutBuilder } from './nfse-layout.builder';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';

const sectionsMod = jest.requireMock('./nfse-sections');
const stylesMod = jest.requireMock('./nfse-styles');
const qrMod = jest.requireMock('./qr.service');
const watermarkMod = jest.requireMock('./watermark');

const makeNota = (overrides: Partial<NfseData> = {}): NfseData =>
  ({
    ChaveNFe: { NumeroNFe: '1' },
    ...overrides,
  }) as unknown as NfseData;

describe('NfseLayoutBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildNotaContent returns the 7 sections in order', async () => {
    const b = await NfseLayoutBuilder.create();
    const content = await b.buildNotaContent(makeNota());

    expect(content).toEqual([
      { sec: 'HEADER' },
      { sec: 'META' },
      { sec: 'PRESTADOR' },
      { sec: 'TOMADOR' },
      { sec: 'DISCRIMINACAO' },
      { sec: 'VALORES' },
      { sec: 'AVISOS' },
    ]);

    expect(sectionsMod.headerMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.metaMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.prestadorMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.tomadorMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.discriminacaoMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.valoresMock).toHaveBeenCalledTimes(1);
    expect(sectionsMod.avisosMock).toHaveBeenCalledTimes(1);
  });

  it('buildDocument composes content for multiple notes and inserts page breaks between them', async () => {
    const b = await NfseLayoutBuilder.create();
    const n1 = makeNota();
    const n2 = makeNota({ ChaveNFe: { NumeroNFe: '2' } as any });

    const doc = await b.buildDocument([n1, n2]);

    expect(Array.isArray(doc.content)).toBe(true);
    expect(doc.content).toHaveLength(15);

    expect(doc.content?.[7]).toEqual({ text: ' ', pageBreak: 'after' });
  });

  it('sets A4 page size, margins (with bottom >= QR box), default style, and uses nfseStyles', async () => {
    const b = await NfseLayoutBuilder.create();
    const doc = await b.buildDocument([makeNota()]);

    expect(doc.pageSize).toBe('A4');
    expect(doc.pageMargins).toEqual([18, 16, 18, 76]);

    expect(doc.defaultStyle).toEqual({ font: 'Helvetica', fontSize: 10 });
    expect(doc.styles).toBe(stylesMod.nfseStyles);
  });

  it('footer shows QR only on the first page and only if QR value exists', async () => {
    const b = await NfseLayoutBuilder.create();
    const nota = makeNota();
    const doc = await b.buildDocument([nota]);

    const firstFooter = (doc.footer as (p: number) => unknown)(1) as any;
    expect(firstFooter).toMatchObject({
      margin: [18, 2, 18, 6],
      columnGap: 10,
      columns: [
        { width: '*', text: '' },
        { width: 'auto', qr: 'QRVALUE', fit: 64, alignment: 'right' },
      ],
    });
    expect(qrMod.buildQrValueMock).toHaveBeenCalledWith(nota);

    const otherFooter = (doc.footer as (p: number) => unknown)(2) as any;
    expect(otherFooter).toEqual({ text: '' });

    qrMod.buildQrValueMock.mockReturnValueOnce(null);
    const emptyQrFooter = (doc.footer as (p: number) => unknown)(1) as any;
    expect(emptyQrFooter).toEqual({ text: '' });
  });

  it('adds cancelled header when cancelled flag is true', async () => {
    const b = await NfseLayoutBuilder.create();
    const doc = await b.buildDocument([makeNota()], true);

    expect(watermarkMod.makeCancelledOverlayHeader).toHaveBeenCalledTimes(1);
    expect(doc).toHaveProperty('header');
    expect(doc.header).toEqual({ text: 'CANCELLED' });
  });

  it('exposes a fonts dictionary with the expected Helvetica entries', () => {
    expect(NfseLayoutBuilder.fonts.Helvetica).toEqual({
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    });
  });
});
