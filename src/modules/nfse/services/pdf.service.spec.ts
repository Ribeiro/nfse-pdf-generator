/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Readable } from 'stream';
import { PdfService } from './pdf.service';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { NfseDto } from 'src/modules/nfse/dto/nfse.dto';

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
    event: 'data' | 'end' | 'error',
    cb: (...a: unknown[]) => void,
  ) => FakePdfDoc;
  once: (
    event: 'data' | 'end' | 'error',
    cb: (...a: unknown[]) => void,
  ) => FakePdfDoc;
  end: () => void;
  emit: (event: string, ...args: unknown[]) => boolean;
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
    emit(event: string, ...args: unknown[]) {
      (handlers[event] ?? []).forEach((cb) => cb(...args));
      return true;
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

jest.mock('xml2js', () => {
  const parseStringPromise = jest.fn().mockResolvedValue({
    NFe: {
      ChaveNFe: {
        NumeroNFe: '123',
        CodigoVerificacao: 'ABCD',
        InscricaoPrestador: '99999',
      },
      ChaveRPS: {
        NumeroRPS: 'RPS-9',
        InscricaoPrestador: '55555',
      },
    },
  });

  return {
    parseStringPromise,
  };
});

const { parseStringPromise: parseStringPromiseMock } =
  jest.requireMock('xml2js');

jest.mock('../../shared/pdf/layout/nfse-layout.builder', () => {
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
  '../../shared/pdf/layout/nfse-layout.builder',
);

function createNfseData(overrides: Partial<NfseData> = {}): NfseData {
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

function createNfseDto(xml?: string): NfseDto {
  return {
    xml: xml || '<NFe><ChaveNFe><NumeroNFe>123</NumeroNFe></ChaveNFe></NFe>',
  } as NfseDto;
}

describe('PdfService (streams + wrappers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if list is empty (single/multiple)', async () => {
    const service = new PdfService();
    await expect(
      service.generateSinglePdfStream([] as unknown as NfseData[]),
    ).rejects.toThrow(/lista de NFS-e.*vazia/i);

    // @ts-expect-error intentional: invalid type
    await expect(service.generateZipStream(null)).rejects.toThrow(/vazia/i);
  });

  it('should initialize pdfmake in constructor and generate PDF via buffer wrapper (single)', async () => {
    const service = new PdfService();

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(mockLoggerInstance.log).toHaveBeenCalledWith(
      'PdfMake inicializado com sucesso (server-side).',
    );

    const list = [createNfseData(), createNfseData()];

    const buffer1 = await service.generateSinglePdfBuffer(list);
    expect(Buffer.isBuffer(buffer1)).toBe(true);
    expect(buffer1.toString()).toBe('PDF');

    const buffer2 = await service.generateSinglePdfBuffer(list);
    expect(buffer2.toString()).toBe('PDF');

    expect(pdfmakeCtor).toHaveBeenCalledTimes(1);
    expect(buildDocMock).toHaveBeenCalledWith(list, true);
  });

  it('should return ZIP (buffer) in multiple mode and use sanitized default filenames', async () => {
    const service = new PdfService();
    const list = [
      createNfseData({
        ChaveNFe: { NumeroNFe: '111' } as unknown as NfseData['ChaveNFe'],
      }),
      createNfseData({
        ChaveNFe: { NumeroNFe: undefined } as unknown as NfseData['ChaveNFe'],
        ChaveRPS: { NumeroRPS: 'RPS-77' } as unknown as NfseData['ChaveRPS'],
      }),
      createNfseData({
        ChaveNFe: { NumeroNFe: undefined } as unknown as NfseData['ChaveNFe'],
        ChaveRPS: { NumeroRPS: undefined } as unknown as NfseData['ChaveRPS'],
      }),
    ];

    const output = await service.generateZipBuffer(list);
    expect(Buffer.isBuffer(output)).toBe(true);
    expect(output.toString()).toBe('ZIP_BUFFER');

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

  it('should use custom filenameFor function (multiple)', async () => {
    const service = new PdfService();
    const list = [createNfseData(), createNfseData()];

    const filenameFor: (n: NfseData, i: number) => string = jest
      .fn()
      .mockImplementation((_n, i) => `custom_${i + 10}.pdf`);

    await service.generateZipBuffer(list, { filenameFor });

    expect(filenameFor).toHaveBeenCalledTimes(2);

    const [filename1] = jszipFileSpy.mock.calls[0];
    const [filename2] = jszipFileSpy.mock.calls[1];

    expect(filename1).toBe('custom_10.pdf');
    expect(filename2).toBe('custom_11.pdf');
  });

  it('should propagate error from PDF emitter when generating single (buffer wrapper)', async () => {
    pdfmakeCtor.mockImplementationOnce((_fonts: unknown) => {
      void _fonts;
      const failingCreatePdf: CreatePdfMock = jest
        .fn<FakePdfDoc, [unknown]>()
        .mockImplementation((_docDef: unknown) => createFakePdfDoc(false));
      return { createPdfKitDocument: failingCreatePdf };
    });

    const service = new PdfService();
    await expect(
      service.generateSinglePdfBuffer([createNfseData()]),
    ).rejects.toThrow(/pdf error from emitter/i);
  });

  it('should sanitize default filenames with non-alphanumeric characters (multiple)', async () => {
    const service = new PdfService();
    const weird = createNfseData({
      ChaveNFe: { NumeroNFe: '12/3 ABC*' } as unknown as NfseData['ChaveNFe'],
    });
    await service.generateZipBuffer([weird]);

    const [filename] = jszipFileSpy.mock.calls[0];
    expect(filename).toBe('nfse-12_3_ABC_.pdf');
  });

  it('should generate stream correctly with NfseDto (single mode)', async () => {
    const service = new PdfService();
    const dto = createNfseDto();

    const stream = await service.generateStream(dto, { mode: 'single' });
    expect(stream).toHaveProperty('on');
    expect(stream).toHaveProperty('once');
    expect(typeof stream.on).toBe('function');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });
    expect(buildDocMock).toHaveBeenCalledWith(expect.any(Array), true);
  });

  it('should generate stream correctly with NfseDto (multiple mode)', async () => {
    const service = new PdfService();
    const dto = createNfseDto();

    const stream = await service.generateStream(dto, { mode: 'multiple' });
    expect(stream).toHaveProperty('on');
    expect(stream).toHaveProperty('once');
    expect(typeof stream.on).toBe('function');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });
    expect(jszipGenerateNodeStreamSpy).toHaveBeenCalled();
  });

  it('should generate buffer correctly with NfseDto (single mode)', async () => {
    const service = new PdfService();
    const dto = createNfseDto();

    const buffer = await service.generateBuffer(dto, { mode: 'single' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('PDF');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });
  });

  it('should generate buffer correctly with NfseDto (multiple mode)', async () => {
    const service = new PdfService();
    const dto = createNfseDto();

    const buffer = await service.generateBuffer(dto, { mode: 'multiple' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('ZIP_BUFFER');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });
  });

  it('should process XML with NFe array correctly', async () => {
    parseStringPromiseMock.mockResolvedValueOnce({
      NFe: [createNfseData(), createNfseData()],
    });

    const service = new PdfService();
    const dto = createNfseDto();

    const buffer = await service.generateBuffer(dto);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    expect(buildDocMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ ChaveNFe: expect.any(Object) }),
        expect.objectContaining({ ChaveNFe: expect.any(Object) }),
      ]),
      true,
    );
  });

  it('should throw error if XML does not contain NFe key', async () => {
    parseStringPromiseMock.mockResolvedValueOnce({
      InvalidRoot: {},
    });

    const service = new PdfService();
    const dto = createNfseDto();

    await expect(service.generateBuffer(dto)).rejects.toThrow(
      /XML não contém a chave "NFe"/,
    );
  });

  it('should throw error if XML parsing fails', async () => {
    parseStringPromiseMock.mockRejectedValueOnce(new Error('Invalid XML'));

    const service = new PdfService();
    const dto = createNfseDto();

    await expect(service.generateBuffer(dto)).rejects.toThrow(
      /Erro ao parsear XML: Invalid XML/,
    );
  });

  it('should use single mode as default when not specified', async () => {
    const service = new PdfService();
    const dto = createNfseDto();

    await service.generateBuffer(dto); // without specifying mode

    expect(buildDocMock).toHaveBeenCalledWith(expect.any(Array), true);
  });
});

describe('PdfService constructor failure', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should throw encapsulated error if PdfPrinter constructor fails', () => {
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
