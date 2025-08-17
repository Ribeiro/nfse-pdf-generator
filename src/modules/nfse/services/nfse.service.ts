import { Injectable, Logger } from '@nestjs/common';
import { PdfService } from '../../shared/pdf/pdf.service';
import { NfseDto } from '../dto/nfse.dto';
import { Parser } from 'xml2js';
import { NfseData, NfseParsed } from '../types/nfse.types';

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);

  constructor(private readonly pdfService: PdfService) {}

  async processarNfse(
    nfseDto: NfseDto,
    opts?: { mode?: 'single' | 'multiple'; zipName?: string },
  ): Promise<Buffer> {
    const xml = nfseDto.xml;
    const parser = new Parser({ explicitArray: false });
    const parsedXml: NfseParsed = await this.parseXml(xml, parser);

    const nfe = parsedXml.NFe;
    const nfseDataList: NfseData[] = Array.isArray(nfe) ? nfe : [nfe];

    return this.pdfService.gerarPdf(nfseDataList, {
      mode: opts?.mode ?? 'single',
      zipName: opts?.zipName,
    });
  }

  private parseXml(xml: string, parser: Parser): Promise<NfseParsed> {
    return new Promise<NfseParsed>((resolve, reject) => {
      parser.parseString(xml, (err: Error | null, result: unknown) => {
        if (err) {
          reject(new Error(`Erro ao parsear XML: ${err.message}`));
          return;
        }
        if (!result) {
          reject(new Error('Resultado do parsing é nulo ou indefinido'));
          return;
        }
        resolve(result as NfseParsed);
      });
    });
  }
}
