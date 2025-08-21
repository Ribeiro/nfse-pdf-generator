/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { PdfService } from './pdf.service';
import { NfseLayoutBuilder } from '../../shared/pdf/layout/nfse-layout.builder';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { NfseDto } from 'src/modules/nfse/dto/nfse.dto';

const loggerSpy = {
  log: jest.spyOn(Logger.prototype, 'log').mockImplementation(),
  error: jest.spyOn(Logger.prototype, 'error').mockImplementation(),
  warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
  debug: jest.spyOn(Logger.prototype, 'debug').mockImplementation(),
  verbose: jest.spyOn(Logger.prototype, 'verbose').mockImplementation(),
};

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
      Helvetica: { normal: 'n', bold: 'b', italics: 'i', bolditalics: 'bi' },
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

const mockNfseLayoutBuilder = {
  buildDocument: jest
    .fn()
    .mockImplementation((_nfseDataList, _cancelled = false, _opts = {}) =>
      Promise.resolve({ content: [] }),
    ),
};

function expectFirstArgEquals(
  mockFn: jest.Mock,
  callIndex: number,
  expectedFirstArg: unknown,
) {
  const call = mockFn.mock.calls[callIndex];
  expect(call).toBeDefined();
  expect(call[0]).toEqual(expectedFirstArg);
}

function expectOptionalSecondBooleanFalse(
  mockFn: jest.Mock,
  callIndex: number,
) {
  const call = mockFn.mock.calls[callIndex];
  if (call.length >= 2) {
    expect(call[1]).toBe(false);
  }
}

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

describe('PdfService (Injectable)', () => {
  let service: PdfService;
  let layoutBuilder: jest.Mocked<NfseLayoutBuilder>;

  beforeEach(async () => {
    jest.clearAllMocks();
    pdfmakeCtor.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: NfseLayoutBuilder,
          useValue: mockNfseLayoutBuilder,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
    layoutBuilder = module.get(NfseLayoutBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(layoutBuilder).toBeDefined();
  });

  it('should initialize pdfmake in constructor', () => {
    expect(pdfmakeCtor).toHaveBeenCalledWith(NfseLayoutBuilder.fonts);
    expect(loggerSpy.log).toHaveBeenCalledWith(
      'PdfMake inicializado com sucesso (server-side).',
    );
  });

  it('should throw error if list is empty (single/multiple)', async () => {
    await expect(
      service.generateSinglePdfStream([] as unknown as NfseData[]),
    ).rejects.toThrow(/lista de NFS-e.*vazia/i);

    // @ts-expect-error intentional: invalid type
    await expect(service.generateZipStream(null)).rejects.toThrow(/vazia/i);
  });

  it('should generate single PDF buffer', async () => {
    const list = [createNfseData(), createNfseData()];

    const buffer = await service.generateSinglePdfBuffer(list);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('PDF');

    const mockFn = layoutBuilder.buildDocument as unknown as jest.Mock;
    expect(mockFn).toHaveBeenCalledTimes(1);
    expectFirstArgEquals(mockFn, 0, list);
    expectOptionalSecondBooleanFalse(mockFn, 0);
  });

  it('should return ZIP (buffer) in multiple mode and use sanitized default filenames', async () => {
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

    const mockFn = layoutBuilder.buildDocument as unknown as jest.Mock;
    expect(mockFn).toHaveBeenCalledTimes(3);

    expectFirstArgEquals(mockFn, 0, [list[0]]);
    expectFirstArgEquals(mockFn, 1, [list[1]]);
    expectFirstArgEquals(mockFn, 2, [list[2]]);

    expectOptionalSecondBooleanFalse(mockFn, 0);
    expectOptionalSecondBooleanFalse(mockFn, 1);
    expectOptionalSecondBooleanFalse(mockFn, 2);
  });

  it('should use custom filenameFor function (multiple)', async () => {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: NfseLayoutBuilder,
          useValue: mockNfseLayoutBuilder,
        },
      ],
    }).compile();

    const failingService = module.get<PdfService>(PdfService);
    await expect(
      failingService.generateSinglePdfBuffer([createNfseData()]),
    ).rejects.toThrow(/pdf error from emitter/i);
  });

  it('should sanitize default filenames with non-alphanumeric characters (multiple)', async () => {
    const weird = createNfseData({
      ChaveNFe: { NumeroNFe: '12/3 ABC*' } as unknown as NfseData['ChaveNFe'],
    });
    await service.generateZipBuffer([weird]);

    const [filename] = jszipFileSpy.mock.calls[0];
    expect(filename).toBe('nfse-12_3_ABC_.pdf');
  });

  it('should generate stream correctly with NfseDto (single mode)', async () => {
    const dto = createNfseDto();

    const stream = await service.generateStream(dto, { mode: 'single' });
    expect(stream).toHaveProperty('on');
    expect(stream).toHaveProperty('once');
    expect(typeof stream.on).toBe('function');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });

    const mockFn = layoutBuilder.buildDocument as unknown as jest.Mock;
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(Array.isArray(mockFn.mock.calls[0][0])).toBe(true);
    expectOptionalSecondBooleanFalse(mockFn, 0);
  });

  it('should generate stream correctly with NfseDto (multiple mode)', async () => {
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
    const dto = createNfseDto();

    const buffer = await service.generateBuffer(dto, { mode: 'single' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('PDF');

    expect(parseStringPromiseMock).toHaveBeenCalledWith(dto.xml, {
      explicitArray: false,
    });
  });

  it('should generate buffer correctly with NfseDto (multiple mode)', async () => {
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

    const dto = createNfseDto();

    const buffer = await service.generateBuffer(dto);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const mockFn = layoutBuilder.buildDocument as unknown as jest.Mock;
    expect(mockFn).toHaveBeenCalledTimes(1);
    const firstArg = mockFn.mock.calls[0][0];
    expect(firstArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ChaveNFe: expect.any(Object) }),
        expect.objectContaining({ ChaveNFe: expect.any(Object) }),
      ]),
    );
    expectOptionalSecondBooleanFalse(mockFn, 0);
  });

  it('should throw error if XML does not contain NFe key', async () => {
    parseStringPromiseMock.mockResolvedValueOnce({
      InvalidRoot: {},
    });

    const dto = createNfseDto();

    await expect(service.generateBuffer(dto)).rejects.toThrow(
      /XML não contém a chave "NFe"/,
    );
  });

  it('should throw error if XML parsing fails', async () => {
    parseStringPromiseMock.mockRejectedValueOnce(new Error('Invalid XML'));

    const dto = createNfseDto();

    await expect(service.generateBuffer(dto)).rejects.toThrow(
      /Erro ao parsear XML: Invalid XML/,
    );
  });

  it('should use single mode as default when not specified', async () => {
    const dto = createNfseDto();

    await service.generateBuffer(dto);

    const mockFn = layoutBuilder.buildDocument as unknown as jest.Mock;
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(Array.isArray(mockFn.mock.calls[0][0])).toBe(true);
    expectOptionalSecondBooleanFalse(mockFn, 0);
  });
});

describe('PdfService constructor failure', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('should throw encapsulated error if PdfPrinter constructor fails', async () => {
    pdfmakeCtor.mockImplementationOnce((_fonts: unknown) => {
      throw new Error('failed to load pdfmake');
    });

    await expect(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PdfService,
          {
            provide: NfseLayoutBuilder,
            useValue: mockNfseLayoutBuilder,
          },
        ],
      }).compile();

      module.get<PdfService>(PdfService);
    }).rejects.toThrow(/Erro ao inicializar pdfMake/i);

    expect(loggerSpy.error).toHaveBeenCalledWith(
      'Erro ao inicializar pdfMake:',
      expect.any(Error),
    );
  });
});

afterAll(() => {
  Object.values(loggerSpy).forEach((spy) => spy.mockRestore());
});
