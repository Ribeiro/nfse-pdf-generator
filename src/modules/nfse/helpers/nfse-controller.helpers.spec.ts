/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { Response } from 'express';
import { NfseControllerHelpers as H } from './nfse-controller.helpers';
import type { PdfGenerationMode, PdfService } from '../services/pdf.service';
import type { NfseDto } from '../dto/nfse.dto';

const makeDto = (overrides: Partial<NfseDto> = {}): NfseDto => ({
  xml: '<Nfse></Nfse>',
  ...overrides,
});

const makeOkReadable = () => {
  const ev = new EventEmitter() as unknown as Readable & { pipe: jest.Mock };
  ev.pipe = jest.fn((dest: EventEmitter) => {
    setImmediate(() => dest.emit('finish'));
    return dest as any;
  });
  return ev;
};

const makeErrorReadable = (err: Error) => {
  const ev = new EventEmitter() as unknown as Readable & { pipe: jest.Mock };
  ev.pipe = jest.fn((dest: EventEmitter) => {
    setImmediate(() => ev.emit('error', err));
    return dest as any;
  });
  return ev;
};

const makeResponse = () => {
  const ev = new EventEmitter() as unknown as Response & {
    setHeader: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
    destroy?: jest.Mock;
    headersSent: boolean;
  };

  ev.setHeader = jest.fn();
  ev.send = jest.fn();
  ev.status = jest.fn(() => ev);
  (ev as any).destroy = jest.fn();
  ev.headersSent = false;

  return ev;
};

const makeService = () => {
  return {
    generateStream: jest.fn(),
  } as unknown as Pick<PdfService, 'generateStream'> & {
    generateStream: jest.Mock;
  };
};

describe('NfseControllerHelpers (stream version)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveMode', () => {
    it('returns provided mode', () => {
      const body = makeDto({ mode: 'multiple' as PdfGenerationMode });
      expect(H.resolveMode(body)).toBe('multiple');
    });

    it('defaults to "single"', () => {
      const body = makeDto();
      expect(H.resolveMode(body)).toBe('single');
    });
  });

  describe('resolveZipName', () => {
    it('returns trimmed name', () => {
      const body = makeDto({ zipName: '  invoices-2025.zip  ' });
      expect(H.resolveZipName(body)).toBe('invoices-2025.zip');
    });

    it('defaults to "notas.zip" when empty/undefined', () => {
      expect(H.resolveZipName(makeDto())).toBe('notas.zip');
      expect(H.resolveZipName(makeDto({ zipName: '   ' }))).toBe('notas.zip');
    });
  });

  describe('generateStream', () => {
    it('delegates to service with correct options', async () => {
      const svc = makeService();
      const body = makeDto({ mode: 'multiple', zipName: 'batch.zip' });
      const mode: PdfGenerationMode = 'multiple';
      const zipName = 'batch.zip';
      const stream = makeOkReadable();

      svc.generateStream.mockResolvedValueOnce(stream);

      const out = await H.generateStream(
        svc as unknown as PdfService,
        body,
        mode,
        zipName,
      );

      expect(svc.generateStream).toHaveBeenCalledTimes(1);
      expect(svc.generateStream).toHaveBeenCalledWith(body, {
        mode,
        zipName,
      });
      expect(out).toBe(stream);
    });
  });

  describe('setResponseHeaders', () => {
    it('sets headers for ZIP (multiple)', () => {
      const res = makeResponse();
      H.setResponseHeaders(res, 'multiple', 'my-batch.zip');

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

    it('sets headers for single PDF', () => {
      const res = makeResponse();
      H.setResponseHeaders(res, 'single', 'ignored.zip');

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

  describe('pipe', () => {
    it('resolves when response finishes (success path)', async () => {
      const res = makeResponse();
      const stream = makeOkReadable();

      await expect(H.pipe(res, stream)).resolves.toBeUndefined();

      expect(stream.pipe).toHaveBeenCalledTimes(1);
      expect((res.status as jest.Mock).mock.calls.length).toBe(0);
      expect((res.send as jest.Mock).mock.calls.length).toBe(0);
    });

    it('resolves when response closes (even without finish)', async () => {
      const res = makeResponse();
      const ev = new EventEmitter() as unknown as Readable & {
        pipe: jest.Mock;
      };
      ev.pipe = jest.fn((dest: EventEmitter) => {
        setImmediate(() => dest.emit('close'));
        return dest as any;
      });

      await expect(H.pipe(res, ev)).resolves.toBeUndefined();
      expect(ev.pipe).toHaveBeenCalledTimes(1);
    });

    it('rejects and sends 500 when stream errors before headers are sent', async () => {
      const res = makeResponse();
      res.headersSent = false;

      const err = new Error('boom');
      const stream = makeErrorReadable(err);

      await expect(H.pipe(res, stream)).rejects.toThrow('boom');

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Falha ao gerar arquivo.');
      expect((res as any).destroy).not.toHaveBeenCalled();
    });

    it('rejects and destroys response when stream errors after headers are sent', async () => {
      const res = makeResponse();
      res.headersSent = true;

      const err = new Error('kaboom');
      const stream = makeErrorReadable(err);

      await expect(H.pipe(res, stream)).rejects.toThrow('kaboom');

      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      expect((res as any).destroy).toHaveBeenCalledTimes(1);
      expect((res as any).destroy.mock.calls[0][0]).toBe(err);
    });
  });
});
