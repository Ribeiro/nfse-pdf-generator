/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Readable } from 'stream';
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
  once: (
    this: FakePdfDoc,
    event: 'data' | 'end' | 'error',
    cb: (...a: unknown[]) => void,
  ) => FakePdfDoc;
  end: () => void;
}

type CreatePdfMock = jest.Mock<FakePdfDoc, [unknown]>;
type FakePrinter = { createPdfKitDocument: CreatePdfMock };

function createFakePdfDoc(ok = true): FakePdfDoc {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const add = (ev: string, cb: (...a: unknown[]) => void) => {
    (handlers[ev] ??= []).push(cb);
  };

  const doc: FakePdfDoc = {
    on(event, cb) {
      add(event, cb);
      return this;
    },
    once(event, cb) {
      let called = false;
      add(event, (...args: unknown[]) => {
        if (!called) {
          called = true;
          cb(...args);
        }
      });
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
  const jszipGenerateNodeStream = jest.fn(() =>
    Readable.from([Buffer.from('ZIP_BUFFER')]),
  );

  const JSZipMock = jest.fn().mockImplementation(() => ({
    file: jszipFile,
    generateNodeStream: jszipGenerateNodeStream,
  }));

  return {
    __esModule: true,
    default: JSZipMock,
    jszipFile,
    jszipGenerateNodeStream,
  };
});

const {
  jszipFile: jszipFileSpy,
  jszipGenerateNodeStream: jszipGenerateNodeStreamSpy,
} = jest.requireMock('jszip');

jest.mock('./layout/nfse-layout.builder', () => {
  const buildDocumentMock = jest.fn().mockResolvedValue({ content: [] });

  class NfseLayoutBuilder {
    static fonts = {
      Roboto: { normal: 'n', bold: 'b', italics: 'i', bolditalics: 'bi' },
    };

    static create(..._args: unknown[]) {
      return Promise.resolve(new NfseLayoutBuilder());
    }

    buildDocument = buildDocumentMock;
  }

  return { __esModule: true, NfseLayoutBuilder, buildDocumentMock };
});

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

describe('PdfService (streams + wrappers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lança erro se a lista estiver vazia (single/multiple)', async () => {
    const svc = new PdfService();
    await expect(
      svc.generateSinglePdfStream([] as unknown as NfseData[]),
    ).rejects.toThrow(/lista de NFS-e.*vazia/i);

    // @ts-expect-error intenção: tipo inválido
    await expect(svc.generateZipStream(null)).rejects.toThrow(/vazia/i);
  });

  it('inicializa pdfmake no construtor e gera PDF via wrapper de buffer (single)', async () => {
    const svc = new PdfService();

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.log).toHaveBeenCalledWith(
      'PdfMake inicializado com sucesso (server-side).',
    );

    const list = [nota(), nota()];

    const buf1 = await svc.generateSinglePdfBuffer(list);
    expect(Buffer.isBuffer(buf1)).toBe(true);
    expect(buf1.toString()).toBe('PDF');

    const buf2 = await svc.generateSinglePdfBuffer(list);
    expect(buf2.toString()).toBe('PDF');

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(buildDocMock).toHaveBeenCalledWith(list, true);
  });

  it('retorna ZIP (buffer) no modo multiple e usa filenames padrão saneados', async () => {
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

    const out = await svc.generateZipBuffer(list);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).toBe('ZIP_BUFFER');

    expect(jszipFileSpy).toHaveBeenCalledTimes(3);

    {
      const [name, streamArg, opts] = jszipFileSpy.mock.calls[0];
      expect(name).toBe('nfse-111.pdf');
      expect(typeof streamArg?.on).toBe('function');
      expect(opts).toMatchObject({ binary: true });
    }
    {
      const [name] = jszipFileSpy.mock.calls[1];
      expect(name).toBe('nfse-RPS-77.pdf');
    }
    {
      const [name] = jszipFileSpy.mock.calls[2];
      expect(name).toBe('nfse-3.pdf');
    }

    expect(buildDocMock).toHaveBeenCalledTimes(3);
    expect(buildDocMock).toHaveBeenNthCalledWith(1, [list[0]]);
  });

  it('usa filenameFor customizado (multiple)', async () => {
    const svc = new PdfService();
    const list = [nota(), nota()];

    const filenameFor: (n: NfseData, i: number) => string = jest
      .fn()
      .mockImplementation((_n, i) => `custom_${i + 10}.pdf`);

    await svc.generateZipBuffer(list, { filenameFor });

    expect(filenameFor).toHaveBeenCalledTimes(2);

    const [n1] = jszipFileSpy.mock.calls[0];
    const [n2] = jszipFileSpy.mock.calls[1];

    expect(n1).toBe('custom_10.pdf');
    expect(n2).toBe('custom_11.pdf');
  });

  it('propaga erro do emitter do PDF ao gerar single (buffer wrapper)', async () => {
    pdfmakeCtor.mockImplementationOnce((_fonts: unknown) => {
      void _fonts;
      const failingCreatePdf: CreatePdfMock = jest
        .fn<FakePdfDoc, [unknown]>()
        .mockImplementation((_docDef: unknown) => createFakePdfDoc(false));
      return { createPdfKitDocument: failingCreatePdf };
    });

    const svc = new PdfService();
    await expect(svc.generateSinglePdfBuffer([nota()])).rejects.toThrow(
      /pdf error from emitter/i,
    );
  });

  it('saneia nomes padrão com caracteres não-alfanuméricos (multiple)', async () => {
    const svc = new PdfService();
    const weird = nota({
      ChaveNFe: { NumeroNFe: '12/3 ABC*' } as unknown as NfseData['ChaveNFe'],
    });
    await svc.generateZipBuffer([weird]);

    const [name] = jszipFileSpy.mock.calls[0];
    expect(name).toBe('nfse-12_3_ABC_.pdf');
  });
});

describe('PdfService constructor failure', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('lança erro encapsulado se o construtor do PdfPrinter falhar', () => {
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
