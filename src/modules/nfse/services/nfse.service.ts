/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import type { NfseDto } from '../dto/nfse.dto';
import type { NfseData, NfseParsed } from '../types/nfse.types';
import {
  PdfService,
  type GeneratePdfOptions,
} from '../../shared/pdf/pdf.service';
import { parseStringPromise } from 'xml2js';

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);

  constructor(private readonly pdfService: PdfService) {}

  async generateStream(
    nfseDto: NfseDto,
    opts: GeneratePdfOptions = {},
  ): Promise<Readable> {
    const nfseDataList = await this.parseAndExtract(nfseDto.xml);
    return this.pdfService.generateStream(nfseDataList, opts);
  }

  async generateBuffer(
    nfseDto: NfseDto,
    opts: GeneratePdfOptions = {},
  ): Promise<Buffer> {
    const nfseDataList = await this.parseAndExtract(nfseDto.xml);
    if ((opts.mode ?? 'single') === 'single') {
      return this.pdfService.generateSinglePdfBuffer(nfseDataList);
    }
    return this.pdfService.generateZipBuffer(nfseDataList, opts);
  }

  private async parseAndExtract(xml: string): Promise<NfseData[]> {
    const parsed = await this.parseXml(xml);
    const nfe = parsed.NFe as NfseData | NfseData[] | undefined;
    if (!nfe) throw new Error('XML não contém a chave "NFe".');
    return Array.isArray(nfe) ? nfe : [nfe];
  }

  private async parseXml(xml: string): Promise<NfseParsed> {
    try {
      const result = await parseStringPromise(xml, { explicitArray: false });
      if (!result || typeof result !== 'object') {
        throw new Error('Resultado do parsing é nulo/indefinido ou inválido');
      }
      return result as NfseParsed;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : require('node:util').inspect(err, { breakLength: 120 });
      throw new Error(`Erro ao parsear XML: ${msg}`);
    }
  }
}
