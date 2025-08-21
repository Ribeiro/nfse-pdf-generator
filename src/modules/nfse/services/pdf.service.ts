/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { NfseData, NfseParsed } from 'src/modules/nfse/types/nfse.types';
import { NfseLayoutBuilder } from '../../shared/pdf/layout/nfse-layout.builder';
import type {
  PdfPrinter,
  PdfPrinterConstructor,
  TDocumentDefinitions,
  PdfKitDocument,
} from '../../shared/pdf/types/pdfmake.types';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';
import { NfseDto } from 'src/modules/nfse/dto/nfse.dto';

export type PdfGenerationMode = 'single' | 'multiple';

export interface GeneratePdfOptions {
  mode?: PdfGenerationMode;
  zipName?: string;
  filenameFor?: (nota: NfseData, index: number) => string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly printer: PdfPrinter;

  constructor() {
    this.printer = this.initializePdfMake();
  }

  private initializePdfMake(): PdfPrinter {
    try {
      const PdfPrinterCtor = require('pdfmake') as PdfPrinterConstructor;
      const printer = new PdfPrinterCtor(NfseLayoutBuilder.fonts);
      this.logger.log('PdfMake inicializado com sucesso (server-side).');
      return printer;
    } catch (error) {
      this.logger.error('Erro ao inicializar pdfMake:', error);
      throw new Error(
        `Erro ao inicializar pdfMake: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
      );
    }
  }

  private docToStream(docDefinition: TDocumentDefinitions): Readable {
    const pdfDoc: PdfKitDocument =
      this.printer.createPdfKitDocument(docDefinition);
    setImmediate(() => pdfDoc.end());
    return pdfDoc as unknown as Readable;
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

  async generateSinglePdfStream(nfseDataList: NfseData[]): Promise<Readable> {
    if (!Array.isArray(nfseDataList) || nfseDataList.length === 0) {
      throw new Error(
        'A lista de NFS-e fornecida está vazia ou não é um array.',
      );
    }
    const builder = await NfseLayoutBuilder.create();
    const docDefinition = await builder.buildDocument(nfseDataList, true);
    return this.docToStream(docDefinition);
  }

  async generateZipStream(
    nfseDataList: NfseData[],
    opts: GeneratePdfOptions = {},
  ): Promise<Readable> {
    if (!Array.isArray(nfseDataList) || nfseDataList.length === 0) {
      throw new Error(
        'A lista de NFS-e fornecida está vazia ou não é um array.',
      );
    }

    const builder = await NfseLayoutBuilder.create();
    const zip = new JSZip();

    const filenameFor =
      opts.filenameFor ??
      ((nota: NfseData, i: number) => this.defaultFilenameFor(nota, i));

    const pdfDocs: PdfKitDocument[] = [];

    for (let i = 0; i < nfseDataList.length; i++) {
      const nota = nfseDataList[i];
      const docDef = await builder.buildDocument([nota]);

      const pdfDoc: PdfKitDocument = this.printer.createPdfKitDocument(docDef);
      pdfDocs.push(pdfDoc);

      const filename = filenameFor(nota, i);
      zip.file(filename, pdfDoc as unknown as Readable, { binary: true });
    }

    const zipStream: Readable = zip.generateNodeStream({
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }) as unknown as Readable;

    for (const d of pdfDocs) {
      d.on('error', (e) => {
        zipStream.emit(
          'error',
          e instanceof Error ? e : new Error('Erro ao ler PDF stream'),
        );
      });
    }

    setImmediate(() => {
      for (const d of pdfDocs) d.end();
    });

    return zipStream;
  }

  async generateStream(
    nfseDto: NfseDto,
    opts: GeneratePdfOptions = {},
  ): Promise<Readable> {
    const mode = opts.mode ?? 'single';
    const nfseDataList = await this.parseAndExtract(nfseDto.xml);

    return mode === 'single'
      ? this.generateSinglePdfStream(nfseDataList)
      : this.generateZipStream(nfseDataList, opts);
  }

  async generateBuffer(
    nfseDto: NfseDto,
    opts: GeneratePdfOptions = {},
  ): Promise<Buffer> {
    const mode = opts.mode ?? 'single';
    const nfseDataList = await this.parseAndExtract(nfseDto.xml);

    return mode === 'single'
      ? this.generateSinglePdfBuffer(nfseDataList)
      : this.generateZipBuffer(nfseDataList, opts);
  }

  async generateSinglePdfBuffer(nfseDataList: NfseData[]): Promise<Buffer> {
    const stream = await this.generateSinglePdfStream(nfseDataList);
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.once('end', () => resolve(Buffer.concat(chunks)));
      stream.once('error', (e) =>
        reject(e instanceof Error ? e : new Error('Erro ao gerar PDF')),
      );
    });
  }

  async generateZipBuffer(
    nfseDataList: NfseData[],
    opts: GeneratePdfOptions = {},
  ): Promise<Buffer> {
    const stream = await this.generateZipStream(nfseDataList, opts);
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.once('end', () => resolve(Buffer.concat(chunks)));
      stream.once('error', (e) =>
        reject(e instanceof Error ? e : new Error('Erro ao gerar ZIP')),
      );
    });
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
