import { Response } from 'express';
import { NfseDto } from '../dto/nfse.dto';
import { NfseService } from '../services/nfse.service';
import { PdfGenerationMode } from '../../shared/pdf/pdf.service';

export class NfseControllerHelpers {
  private constructor() {}

  static resolveMode(body: NfseDto): PdfGenerationMode {
    return (body.mode ?? 'single') as PdfGenerationMode;
  }

  static resolveZipName(body: NfseDto): string {
    return body.zipName?.trim() || 'notas.zip';
  }

  static async generateBuffer(
    nfseService: NfseService,
    body: NfseDto,
    mode: PdfGenerationMode,
    zipName: string,
  ): Promise<Buffer> {
    return nfseService.processNfse(body, { mode, zipName });
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

  static sendBuffer(res: Response, buffer: Buffer) {
    return res.send(buffer);
  }
}
