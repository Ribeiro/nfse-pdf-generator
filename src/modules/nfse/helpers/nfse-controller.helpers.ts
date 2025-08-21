/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Response } from 'express';
import { Readable } from 'stream';
import type { NfseDto } from '../dto/nfse.dto';
import type { PdfGenerationMode, PdfService } from '../services/pdf.service';

export class NfseControllerHelpers {
  private constructor() {}

  static resolveMode(body: NfseDto): PdfGenerationMode {
    return (body.mode ?? 'single') as PdfGenerationMode;
  }

  static resolveZipName(body: NfseDto): string {
    return body.zipName?.trim() || 'notas.zip';
  }

  static async generateStream(
    pdfService: PdfService,
    body: NfseDto,
    mode: PdfGenerationMode,
    zipName: string,
  ): Promise<Readable> {
    return pdfService.generateStream(body, { mode, zipName });
  }

  static setResponseHeaders(
    res: Response,
    mode: PdfGenerationMode,
    zipName: string,
  ): void {
    if (mode === 'multiple') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="notas.pdf"');
    }
  }

  static pipe(res: Response, stream: Readable): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.once('error', (err) => {
        if (!res.headersSent) {
          res.status(500).send('Falha ao gerar arquivo.');
        } else {
          (res as any).destroy?.(err);
        }
        reject(err instanceof Error ? err : new Error('Stream error'));
      });

      res.once('finish', () => resolve());
      res.once('close', () => resolve());

      stream.pipe(res);
    });
  }
}
