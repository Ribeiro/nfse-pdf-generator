import { Injectable, Logger } from '@nestjs/common';
import { PdfService } from '../../shared/pdf/pdf.service';
import { NfseDto } from '../dto/nfse.dto';
import { Parser } from 'xml2js';
import { NfseParsed } from '../types/nfse.types';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);
  private readonly logoDataUrl?: string;

  constructor(private readonly pdfService: PdfService) {
    this.logoDataUrl = this.loadLogoDataUrl();
  }

  private loadLogoDataUrl(): string | undefined {
    const candidates = [
      path.resolve(__dirname, '../../../assets/logo-prefeitura.png'),
      path.resolve(process.cwd(), 'assets/logo-prefeitura.png'),
    ];

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const base64 = fs.readFileSync(filePath).toString('base64');
          this.logger.log(`Logo carregada: ${filePath}`);
          return `data:image/png;base64,${base64}`;
        }
      } catch (err) {
        this.logger.warn(
          `Falha ao tentar carregar logo em ${filePath}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.warn(
      'Logo da prefeitura não encontrada. O PDF será gerado sem imagem de logo.',
    );
    return undefined;
  }

  async processarNfse(
    nfseDto: NfseDto,
    opts?: { mode?: 'single' | 'multiple'; zipName?: string },
  ): Promise<Buffer> {
    const xml = nfseDto.xml;
    const parser = new Parser({ explicitArray: false });
    const parsedXml: NfseParsed = await this.parseXml(xml, parser);

    const nfseDataList = Array.isArray(parsedXml.Nfse.InfNfse)
      ? parsedXml.Nfse.InfNfse
      : [parsedXml.Nfse.InfNfse];

    return this.pdfService.gerarPdf(nfseDataList, {
      logo: this.logoDataUrl,
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
