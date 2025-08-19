import { NfseService } from './nfse.service';
import { PdfService } from '../../shared/pdf/pdf.service';
import { NfseDto } from '../dto/nfse.dto';
import type { NfseParsed, NfseData } from '../types/nfse.types';
import { Parser } from 'xml2js';

jest.mock('xml2js', () => {
  return {
    Parser: jest.fn().mockImplementation(() => ({
      parseString: jest.fn(),
    })),
  };
});

describe('NfseService', () => {
  const makeDto = (overrides: Partial<NfseDto> = {}): NfseDto => ({
    xml: '<NFe></NFe>',
    ...overrides,
  });

  const createPdfServiceMock = (): jest.Mocked<
    Pick<PdfService, 'generatePdf'>
  > => ({
    generatePdf: jest.fn(),
  });

  let service: NfseService;
  let pdfService: ReturnType<typeof createPdfServiceMock>;

  const setParserBehavior = (
    impl: (
      xml: string,
      cb: (err: Error | null, result?: unknown) => void,
    ) => void,
  ) => {
    const ParserMock = Parser as unknown as jest.MockedClass<typeof Parser>;
    ParserMock.mockImplementation(
      () =>
        ({
          parseString: impl,
        }) as unknown as InstanceType<typeof Parser>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pdfService = createPdfServiceMock();
    service = new NfseService(pdfService as unknown as PdfService);
  });

  describe('processNfse', () => {
    it('should parse XML, wrap single NFe as array, and call gerarPdf with default options', async () => {
      const parsed: NfseParsed = {
        NFe: { any: 'value' } as unknown as NfseData,
      };

      setParserBehavior((_xml, cb) => cb(null, parsed));

      const dto = makeDto();
      const expectedBuffer = Buffer.from('pdf');
      pdfService.generatePdf.mockResolvedValueOnce(expectedBuffer);

      const result = await service.processNfse(dto);

      expect(pdfService.generatePdf).toHaveBeenCalledTimes(1);
      const [dataArg, optionsArg] = pdfService.generatePdf.mock.calls[0];
      expect(Array.isArray(dataArg)).toBe(true);
      expect(dataArg).toEqual([{ any: 'value' }]);
      expect(optionsArg).toEqual({ mode: 'single', zipName: undefined });
      expect(result).toBe(expectedBuffer);
    });

    it('should forward explicit mode and zipName to gerarPdf', async () => {
      const parsed: NfseParsed = {
        NFe: [{ id: 1 }, { id: 2 }] as unknown as NfseData[],
      };

      setParserBehavior((_xml, cb) => cb(null, parsed));

      const dto = makeDto();
      const expectedBuffer = Buffer.from('zip');
      pdfService.generatePdf.mockResolvedValueOnce(expectedBuffer);

      const result = await service.processNfse(dto, {
        mode: 'multiple',
        zipName: 'batch.zip',
      });

      expect(pdfService.generatePdf).toHaveBeenCalledTimes(1);
      const [dataArg, optionsArg] = pdfService.generatePdf.mock.calls[0];
      expect(dataArg).toEqual([{ id: 1 }, { id: 2 }]);
      expect(optionsArg).toEqual({ mode: 'multiple', zipName: 'batch.zip' });
      expect(result).toBe(expectedBuffer);
    });

    it('should reject when parser returns an error', async () => {
      setParserBehavior((_xml, cb) => cb(new Error('invalid xml')));

      const dto = makeDto();

      await expect(service.processNfse(dto)).rejects.toThrow(
        'Erro ao parsear XML: invalid xml',
      );
      expect(pdfService.generatePdf).not.toHaveBeenCalled();
    });

    it('should reject when parser returns undefined result', async () => {
      setParserBehavior((_xml, cb) => cb(null, undefined));

      const dto = makeDto();

      await expect(service.processNfse(dto)).rejects.toThrow(
        'Resultado do parsing é nulo ou indefinido',
      );
      expect(pdfService.generatePdf).not.toHaveBeenCalled();
    });
  });
});
