/* eslint-disable @typescript-eslint/unbound-method */
import { Response } from 'express';
import { NfseControllerHelpers } from './nfse-controller.helpers';
import { PdfGenerationMode } from '../../shared/pdf/pdf.service';
import { NfseService } from '../services/nfse.service';
import { NfseDto } from '../dto/nfse.dto';

const makeDto = (overrides: Partial<NfseDto> = {}): NfseDto => ({
  xml: '<Nfse></Nfse>',
  ...overrides,
});

describe('NfseControllerHelpers', () => {
  const mockResponse = (): Response => {
    const res: Partial<Response> = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    return res as Response;
  };

  const mockNfseService = (): Pick<NfseService, 'processNfse'> & {
    processNfse: jest.Mock;
  } => ({
    processNfse: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveMode', () => {
    it('should return the provided mode when present', () => {
      const body = makeDto({ mode: 'multiple' as PdfGenerationMode });
      const mode = NfseControllerHelpers.resolveMode(body);
      expect(mode).toBe('multiple');
    });

    it('should default to "single" when mode is not provided', () => {
      const body = makeDto();
      const mode = NfseControllerHelpers.resolveMode(body);
      expect(mode).toBe('single');
    });
  });

  describe('resolveZipName', () => {
    it('should return the trimmed zipName when provided', () => {
      const body = makeDto({ zipName: '  invoices-2025.zip  ' });
      const zip = NfseControllerHelpers.resolveZipName(body);
      expect(zip).toBe('invoices-2025.zip');
    });

    it('should return "notas.zip" when zipName is not provided', () => {
      const body = makeDto();
      const zip = NfseControllerHelpers.resolveZipName(body);
      expect(zip).toBe('notas.zip');
    });

    it('should return "notas.zip" when zipName is empty/whitespace', () => {
      const body = makeDto({ zipName: '   ' });
      const zip = NfseControllerHelpers.resolveZipName(body);
      expect(zip).toBe('notas.zip');
    });
  });

  describe('generateBuffer', () => {
    it('should call the service with correct body and options and return the buffer', async () => {
      const nfseService = mockNfseService();
      const expected = Buffer.from('pdf-or-zip');
      nfseService.processNfse.mockResolvedValueOnce(expected);

      const body = makeDto({ mode: 'multiple', zipName: 'batch.zip' });
      const mode: PdfGenerationMode = 'multiple';
      const zipName = 'batch.zip';

      const result = await NfseControllerHelpers.generateBuffer(
        nfseService as unknown as NfseService,
        body,
        mode,
        zipName,
      );

      expect(nfseService.processNfse).toHaveBeenCalledTimes(1);
      expect(nfseService.processNfse).toHaveBeenCalledWith(body, {
        mode,
        zipName,
      });
      expect(result).toBe(expected);
    });
  });

  describe('setResponseHeaders', () => {
    it('should set headers for multiple PDFs (zip)', () => {
      const res = mockResponse();
      NfseControllerHelpers.setResponseHeaders(res, 'multiple', 'my-batch.zip');

      expect(res.setHeader).toHaveBeenCalledTimes(2);
      expect(res.setHeader).toHaveBeenNthCalledWith(
        1,
        'Content-Type',
        'application/zip',
      );
      expect(res.setHeader).toHaveBeenNthCalledWith(
        2,
        'Content-Disposition',
        'attachment; filename="my-batch.zip"',
      );
    });

    it('should set headers for a single PDF', () => {
      const res = mockResponse();
      NfseControllerHelpers.setResponseHeaders(res, 'single', 'ignored.zip');

      expect(res.setHeader).toHaveBeenCalledTimes(2);
      expect(res.setHeader).toHaveBeenNthCalledWith(
        1,
        'Content-Type',
        'application/pdf',
      );
      expect(res.setHeader).toHaveBeenNthCalledWith(
        2,
        'Content-Disposition',
        'inline; filename="notas.pdf"',
      );
    });
  });

  describe('sendBuffer', () => {
    it('should delegate to res.send(buffer) and return the result', () => {
      const res = mockResponse();
      const buf = Buffer.from('content');
      (res.send as jest.Mock).mockReturnValueOnce('ok');

      const out = NfseControllerHelpers.sendBuffer(res, buf);

      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith(buf);
      expect(out).toBe('ok');
    });
  });
});
