import { Injectable, Logger } from '@nestjs/common';
import { NfseData } from 'src/modules/nfse/types/nfse.types';
import { NfseLayoutBuilder } from './layout/nfse-layout.builder';
import type {
  PdfPrinter,
  PdfPrinterConstructor,
  TDocumentDefinitions,
} from './types/pdfmake.types';
import JSZip from 'jszip';

export type PdfGenerationMode = 'single' | 'multiple';

export interface GerarPdfOptions {
  mode?: PdfGenerationMode;
  zipName?: string;
  filenameFor?: (nota: NfseData, index: number) => string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private printer: PdfPrinter | null = null;
  private isInitialized = false;

  private initializePdfMake(): void {
    if (this.isInitialized && this.printer) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PdfPrinterCtor = require('pdfmake') as PdfPrinterConstructor;

      this.printer = new PdfPrinterCtor(NfseLayoutBuilder.fonts);

      this.isInitialized = true;
      this.logger.log('PdfMake inicializado com sucesso (server-side).');
    } catch (error) {
      this.logger.error('Erro ao inicializar pdfMake:', error);
      throw new Error(
        `Erro ao inicializar pdfMake: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
      );
    }
  }

  private docToBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        if (!this.printer) {
          return reject(new Error('PdfMake não foi inicializado corretamente'));
        }
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (c: Buffer) => chunks.push(c));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (e: Error) =>
          reject(e instanceof Error ? e : new Error('Erro desconhecido')),
        );
        pdfDoc.end();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao gerar PDF'));
      }
    });
  }

  private sanitizeFilenamePart(s: string): string {
    return s.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  private defaultFilenameFor(nota: NfseData, index: number): string {
    const numero =
      nota?.ChaveNFe?.NumeroNFe ??
      nota?.ChaveRPS?.NumeroRPS ??
      String(index + 1);

    return `nfse-${this.sanitizeFilenamePart(numero)}.pdf`;
  }

  async gerarPdf(
    nfseDataList: NfseData[],
    opts: GerarPdfOptions = {},
  ): Promise<Buffer> {
    if (!Array.isArray(nfseDataList) || nfseDataList.length === 0) {
      throw new Error(
        'A lista de NFS-e fornecida está vazia ou não é um array.',
      );
    }

    this.initializePdfMake();

    const mode: PdfGenerationMode = opts.mode ?? 'single';
    const builder = new NfseLayoutBuilder();

    if (mode === 'single') {
      const docDefinition = builder.buildDocument(nfseDataList, true);
      return this.docToBuffer(docDefinition);
    }

    const zip = new JSZip();
    const filenameFor: (nota: NfseData, index: number) => string =
      opts.filenameFor
        ? (n, i) => opts.filenameFor!(n, i)
        : (n, i) => this.defaultFilenameFor(n, i);

    for (let i = 0; i < nfseDataList.length; i++) {
      const nota = nfseDataList[i];
      const docDefinition = builder.buildDocument([nota]);
      const pdfBuffer = await this.docToBuffer(docDefinition);
      const filename = filenameFor(nota, i);
      zip.file(filename, pdfBuffer);
    }

    const zipBuffer: Buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return zipBuffer;
  }
}
