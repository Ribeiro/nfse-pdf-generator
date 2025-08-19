/* eslint-disable @typescript-eslint/no-unused-vars */
import { PdfService } from './pdf.service';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';

const mockLoggerInstance = { log: jest.fn(), error: jest.fn() };

jest.mock('@nestjs/common', () => {
  const Injectable = () => (_: unknown) => {
    /* no-op */
  };
  class Logger {
    log = mockLoggerInstance.log;
    error = mockLoggerInstance.error;
  }
  return { Injectable, Logger };
});

interface FakePdfDoc {
  on: (
    this: FakePdfDoc,
    event: 'data' | 'end' | 'error',
    cb: (...a: unknown[]) => void,
  ) => FakePdfDoc;
  end: () => void;
}

type CreatePdfMock = jest.Mock<FakePdfDoc, [unknown]>;

type FakePrinter = {
  createPdfKitDocument: CreatePdfMock;
};

function createFakePdfDoc(ok = true): FakePdfDoc {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const doc: FakePdfDoc = {
    on(event, cb) {
      (handlers[event] ??= []).push(cb);
      return this;
    },
    end() {
      if (!ok) {
        (handlers.error ?? []).forEach((cb) =>
          cb(new Error('pdf error from emitter')),
        );
        return;
      }
      (handlers.data ?? []).forEach((cb) => cb(Buffer.from('PDF')));
      (handlers.end ?? []).forEach((cb) => cb());
    },
  };
  return doc;
}

const pdfmakeCtor: jest.Mock<FakePrinter, [unknown]> = jest
  .fn<FakePrinter, [unknown]>()
  .mockImplementation((_fonts: unknown) => {
    void _fonts;
    const createPdfKitDocument: CreatePdfMock = jest
      .fn<FakePdfDoc, [unknown]>()
      .mockImplementation((_docDef: unknown) => createFakePdfDoc(true));
    return { createPdfKitDocument };
  });

jest.mock('pdfmake', () => pdfmakeCtor);

jest.mock('jszip', () => {
  const jszipFile = jest.fn();
  const jszipGenerateAsync = jest
    .fn()
    .mockResolvedValue(Buffer.from('ZIP_BUFFER'));

  const JSZipMock = jest.fn().mockImplementation(() => ({
    file: jszipFile,
    generateAsync: jszipGenerateAsync,
  }));

  return {
    __esModule: true,
    default: JSZipMock,
    jszipFile,
    jszipGenerateAsync,
  };
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { jszipFile: jszipFileSpy, jszipGenerateAsync: jszipGenerateAsyncSpy } =
  jest.requireMock('jszip');

jest.mock('./layout/nfse-layout.builder', () => {
  const buildDocumentMock = jest.fn().mockReturnValue({ content: [] });

  class NfseLayoutBuilder {
    static fonts = {
      Roboto: { normal: 'n', bold: 'b', italics: 'i', bolditalics: 'bi' },
    };
    buildDocument = buildDocumentMock;
  }

  return { __esModule: true, NfseLayoutBuilder, buildDocumentMock };
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { buildDocumentMock: buildDocMock } = jest.requireMock(
  './layout/nfse-layout.builder',
);

function nota(overrides: Partial<NfseData> = {}): NfseData {
  return {
    ChaveNFe: {
      NumeroNFe: '123',
      CodigoVerificacao: 'ABCD',
      InscricaoPrestador: '99999',
    },
    ChaveRPS: {
      NumeroRPS: 'RPS-9',
      InscricaoPrestador: '55555',
    },
    ...overrides,
  } as unknown as NfseData;
}

describe('PdfService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws if nfseDataList is empty or not an array', async () => {
    const svc = new PdfService();
    await expect(svc.generatePdf([] as unknown as NfseData[])).rejects.toThrow(
      /lista de NFS-e.*vazia/i,
    );
    // @ts-expect-error teste proposital com tipo inválido
    await expect(svc.generatePdf(null)).rejects.toThrow(/vazia/i);
  });

  it('initializes pdfmake in the constructor once per service instance (single mode)', async () => {
    const svc = new PdfService();

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.log).toHaveBeenCalledWith(
      'PdfMake inicializado com sucesso (server-side).',
    );

    const list = [nota(), nota()];

    const buf1 = await svc.generatePdf(list, { mode: 'single' });
    expect(Buffer.isBuffer(buf1)).toBe(true);
    expect(buf1.toString()).toBe('PDF');

    const buf2 = await svc.generatePdf(list, { mode: 'single' });
    expect(buf2.toString()).toBe('PDF');

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(buildDocMock).toHaveBeenCalledWith(list, true);
  });

  it('returns a zipped buffer in multiple mode and uses default filenames', async () => {
    const svc = new PdfService();
    const list = [
      nota({
        ChaveNFe: { NumeroNFe: '111' } as unknown as NfseData['ChaveNFe'],
      }),
      nota({
        ChaveNFe: { NumeroNFe: undefined } as unknown as NfseData['ChaveNFe'],
        ChaveRPS: { NumeroRPS: 'RPS-77' } as unknown as NfseData['ChaveRPS'],
      }),
      nota({
        ChaveNFe: { NumeroNFe: undefined } as unknown as NfseData['ChaveNFe'],
        ChaveRPS: { NumeroRPS: undefined } as unknown as NfseData['ChaveRPS'],
      }),
    ];

    const out = await svc.generatePdf(list, { mode: 'multiple' });
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).toBe('ZIP_BUFFER');

    expect(jszipFileSpy).toHaveBeenCalledTimes(3);
    expect(jszipFileSpy).toHaveBeenNthCalledWith(
      1,
      'nfse-111.pdf',
      expect.any(Buffer),
    );
    expect(jszipFileSpy).toHaveBeenNthCalledWith(
      2,
      'nfse-RPS-77.pdf',
      expect.any(Buffer),
    );
    expect(jszipFileSpy).toHaveBeenNthCalledWith(
      3,
      'nfse-3.pdf',
      expect.any(Buffer),
    );

    expect(buildDocMock).toHaveBeenCalledTimes(3);
    expect(buildDocMock).toHaveBeenNthCalledWith(1, [list[0]]);
  });

  it('uses custom filenameFor when provided (multiple mode)', async () => {
    const svc = new PdfService();
    const list = [nota(), nota()];

    const filenameFor: (n: NfseData, i: number) => string = jest
      .fn()
      .mockImplementation((_n, i) => `custom_${i + 10}.pdf`);

    await svc.generatePdf(list, { mode: 'multiple', filenameFor });

    expect(filenameFor).toHaveBeenCalledTimes(2);
    expect(jszipFileSpy).toHaveBeenNthCalledWith(
      1,
      'custom_10.pdf',
      expect.any(Buffer),
    );
    expect(jszipFileSpy).toHaveBeenNthCalledWith(
      2,
      'custom_11.pdf',
      expect.any(Buffer),
    );
  });

  it('propagates pdf emitter error when creating a single PDF', async () => {
    pdfmakeCtor.mockImplementationOnce((_fonts: unknown) => {
      void _fonts;
      const failingCreatePdf: CreatePdfMock = jest
        .fn<FakePdfDoc, [unknown]>()
        .mockImplementation((_docDef: unknown) => createFakePdfDoc(false));
      return { createPdfKitDocument: failingCreatePdf };
    });

    const svc = new PdfService();
    await expect(svc.generatePdf([nota()], { mode: 'single' })).rejects.toThrow(
      /pdf error from emitter/i,
    );
  });

  it('sanitizes default filenames (non-alphanumeric -> underscore) in multiple mode', async () => {
    const svc = new PdfService();
    const weird = nota({
      ChaveNFe: { NumeroNFe: '12/3 ABC*' } as unknown as NfseData['ChaveNFe'],
    });
    await svc.generatePdf([weird], { mode: 'multiple' });

    expect(jszipFileSpy).toHaveBeenCalledWith(
      'nfse-12_3_ABC_.pdf',
      expect.any(Buffer),
    );
  });
});

describe('PdfService constructor failure', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('throws a wrapped error if PdfPrinter constructor fails', () => {
    pdfmakeCtor.mockImplementationOnce((_fonts: unknown) => {
      throw new Error('failed to load pdfmake');
    });

    expect(() => new PdfService()).toThrow(/Erro ao inicializar pdfMake/i);

    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      'Erro ao inicializar pdfMake:',
      expect.any(Error),
    );
  });
});
