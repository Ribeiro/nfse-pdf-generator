import { Readable } from 'stream';
import { NfseService } from './nfse.service';
import type { PdfService } from '../../shared/pdf/pdf.service';
import type { NfseDto } from '../dto/nfse.dto';
import type { NfseParsed, NfseData } from '../types/nfse.types';
import { parseStringPromise } from 'xml2js';

jest.mock('xml2js', () => ({
  parseStringPromise: jest.fn(),
}));

const makeDto = (overrides: Partial<NfseDto> = {}): NfseDto => ({
  xml: '<NFe></NFe>',
  ...overrides,
});

const createPdfServiceMock = () =>
  ({
    generateStream: jest.fn(),
    generateSinglePdfBuffer: jest.fn(),
    generateZipBuffer: jest.fn(),
  }) as unknown as jest.Mocked<
    Pick<
      PdfService,
      'generateStream' | 'generateSinglePdfBuffer' | 'generateZipBuffer'
    >
  >;

describe('NfseService (stream/buffer)', () => {
  let service: NfseService;
  let pdfService: ReturnType<typeof createPdfServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    pdfService = createPdfServiceMock();
    service = new NfseService(pdfService as unknown as PdfService);
  });

  describe('generateStream', () => {
    it('parses XML, extrai NFe (single -> array) e delega para pdfService.generateStream com as opções', async () => {
      const parsed: NfseParsed = { NFe: { id: 1 } as unknown as NfseData };
      (parseStringPromise as jest.Mock).mockResolvedValueOnce(parsed);

      const body = makeDto();
      const stream = Readable.from(['ok']);
      pdfService.generateStream.mockResolvedValueOnce(
        stream as unknown as Readable,
      );

      const out = await service.generateStream(body, {
        mode: 'multiple',
        zipName: 'batch.zip',
      });

      expect(parseStringPromise).toHaveBeenCalledWith(body.xml, {
        explicitArray: false,
      });
      expect(pdfService.generateStream).toHaveBeenCalledWith([{ id: 1 }], {
        mode: 'multiple',
        zipName: 'batch.zip',
      });
      expect(out).toBe(stream);
    });
  });

  describe('generateBuffer', () => {
    it('single (default): usa generateSinglePdfBuffer e envolve NFe objeto em array', async () => {
      const parsed: NfseParsed = {
        NFe: { any: 'value' } as unknown as NfseData,
      };
      (parseStringPromise as jest.Mock).mockResolvedValueOnce(parsed);

      const expected = Buffer.from('pdf');
      pdfService.generateSinglePdfBuffer.mockResolvedValueOnce(expected);

      const res = await service.generateBuffer(makeDto());

      expect(pdfService.generateSinglePdfBuffer).toHaveBeenCalledTimes(1);
      expect(pdfService.generateSinglePdfBuffer).toHaveBeenCalledWith([
        { any: 'value' },
      ]);
      expect(res).toBe(expected);
      expect(pdfService.generateZipBuffer).not.toHaveBeenCalled();
    });

    it('multiple: usa generateZipBuffer e repassa array de NFe', async () => {
      const parsed: NfseParsed = {
        NFe: [{ id: 1 }, { id: 2 }] as unknown as NfseData[],
      };
      (parseStringPromise as jest.Mock).mockResolvedValueOnce(parsed);

      const expected = Buffer.from('zip');
      pdfService.generateZipBuffer.mockResolvedValueOnce(expected);

      const res = await service.generateBuffer(makeDto(), {
        mode: 'multiple',
        zipName: 'z.zip',
      });

      expect(pdfService.generateZipBuffer).toHaveBeenCalledTimes(1);
      expect(pdfService.generateZipBuffer).toHaveBeenCalledWith(
        [{ id: 1 }, { id: 2 }],
        {
          mode: 'multiple',
          zipName: 'z.zip',
        },
      );
      expect(res).toBe(expected);
      expect(pdfService.generateSinglePdfBuffer).not.toHaveBeenCalled();
    });
  });

  describe('erros de parsing', () => {
    it('propaga erro quando parseStringPromise rejeita', async () => {
      (parseStringPromise as jest.Mock).mockRejectedValueOnce(
        new Error('invalid xml'),
      );

      await expect(service.generateBuffer(makeDto())).rejects.toThrow(
        'Erro ao parsear XML: invalid xml',
      );

      expect(pdfService.generateSinglePdfBuffer).not.toHaveBeenCalled();
      expect(pdfService.generateZipBuffer).not.toHaveBeenCalled();
    });

    it('wrap de erro quando parseStringPromise resolve com valor inválido (null/nao-objeto)', async () => {
      (parseStringPromise as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.generateBuffer(makeDto())).rejects.toThrow(
        'Erro ao parsear XML: Resultado do parsing é nulo/indefinido ou inválido',
      );
    });

    it('erro específico quando não existe chave NFe', async () => {
      (parseStringPromise as jest.Mock).mockResolvedValueOnce({ Outra: 1 });

      await expect(service.generateBuffer(makeDto())).rejects.toThrow(
        'XML não contém a chave "NFe".',
      );
    });
  });
});
