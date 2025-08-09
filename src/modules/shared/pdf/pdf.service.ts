import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

// Interfaces para tipagem adequada do pdfMake server-side
interface FontDescriptor {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

interface FontDictionary {
  [fontName: string]: FontDescriptor;
}

interface PdfPrinterConstructor {
  new (fontDescriptors: FontDictionary): PdfPrinter;
}

interface PdfPrinter {
  createPdfKitDocument(docDefinition: TDocumentDefinitions): PdfKitDocument;
}

interface PdfKitDocument extends EventEmitter {
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  end(): void;
}

interface TDocumentDefinitions {
  content: any[];
  styles?: Record<string, any>;
  defaultStyle?: Record<string, any>;
}

// Interface para estrutura de XML parseado (pode vir como array ou objeto único)
interface NfseData {
  Numero: string | string[];
  CodigoVerificacao: string | string[];
  DataEmissao: string | string[];
  PrestadorServico:
    | {
        RazaoSocial: string | string[];
        IdentificacaoPrestador?: {
          Cnpj?: string | string[];
        };
      }
    | Array<{
        RazaoSocial: string[];
        IdentificacaoPrestador: Array<{
          Cnpj: string[];
        }>;
      }>;
  TomadorServico:
    | {
        RazaoSocial: string | string[];
        IdentificacaoTomador: {
          CpfCnpj: {
            Cnpj: string | string[];
          };
        };
      }
    | Array<{
        RazaoSocial: string[];
        IdentificacaoTomador: Array<{
          CpfCnpj: Array<{
            Cnpj: string[];
          }>;
        }>;
      }>;
  Servico:
    | {
        Valores: {
          ValorServicos: string | string[];
          ValorIss: string | string[];
        };
        Discriminacao: string | string[];
      }
    | Array<{
        Valores: Array<{
          ValorServicos: string[];
          ValorIss: string[];
        }>;
        Discriminacao: string[];
      }>;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private printer: PdfPrinter | null = null;
  private isInitialized = false;

  private initializePdfMake(): void {
    if (this.isInitialized && this.printer) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PdfPrinterConstructor = require('pdfmake') as PdfPrinterConstructor;

      const fonts: FontDictionary = {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique',
        },
        Times: {
          normal: 'Times-Roman',
          bold: 'Times-Bold',
          italics: 'Times-Italic',
          bolditalics: 'Times-BoldItalic',
        },
        Courier: {
          normal: 'Courier',
          bold: 'Courier-Bold',
          italics: 'Courier-Oblique',
          bolditalics: 'Courier-BoldOblique',
        },
      };

      this.printer = new PdfPrinterConstructor(fonts);
      this.isInitialized = true;
      this.logger.log('PdfMake inicializado com sucesso para server-side');
    } catch (error) {
      this.logger.error('Erro ao inicializar pdfMake:', error);
      throw new Error(
        `Erro ao inicializar pdfMake: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }

  private getFirstValue(value: string | string[] | undefined): string {
    if (!value) return 'Não informado';
    return Array.isArray(value) ? value[0] : value;
  }

  private getPrestadorData(prestador: NfseData['PrestadorServico']) {
    if (Array.isArray(prestador)) {
      return {
        razaoSocial: this.getFirstValue(prestador[0]?.RazaoSocial),
        cnpj: this.getFirstValue(
          prestador[0]?.IdentificacaoPrestador?.[0]?.Cnpj,
        ),
      };
    }
    return {
      razaoSocial: this.getFirstValue(prestador.RazaoSocial),
      cnpj: this.getFirstValue(prestador.IdentificacaoPrestador?.Cnpj),
    };
  }

  private getTomadorData(tomador: NfseData['TomadorServico']) {
    if (Array.isArray(tomador)) {
      return {
        razaoSocial: this.getFirstValue(tomador[0]?.RazaoSocial),
        cnpj: this.getFirstValue(
          tomador[0]?.IdentificacaoTomador?.[0]?.CpfCnpj?.[0]?.Cnpj,
        ),
      };
    }
    return {
      razaoSocial: this.getFirstValue(tomador.RazaoSocial),
      cnpj: this.getFirstValue(tomador.IdentificacaoTomador?.CpfCnpj?.Cnpj),
    };
  }

  private getServicoData(servico: NfseData['Servico']) {
    if (Array.isArray(servico)) {
      return {
        valorServicos: this.getFirstValue(
          servico[0]?.Valores?.[0]?.ValorServicos,
        ),
        valorIss: this.getFirstValue(servico[0]?.Valores?.[0]?.ValorIss),
        discriminacao: this.getFirstValue(servico[0]?.Discriminacao),
      };
    }
    return {
      valorServicos: this.getFirstValue(servico.Valores?.ValorServicos),
      valorIss: this.getFirstValue(servico.Valores?.ValorIss),
      discriminacao: this.getFirstValue(servico.Discriminacao),
    };
  }

  async gerarPdf(nfseDataList: NfseData[]): Promise<Buffer> {
    try {
      // Verificar se a lista de NFS-e não está vazia e se é um array
      if (!Array.isArray(nfseDataList) || nfseDataList.length === 0) {
        throw new Error(
          'A lista de NFS-e fornecida está vazia ou não é um array.',
        );
      }

      this.initializePdfMake();

      if (!this.printer) {
        throw new Error('PdfMake não foi inicializado corretamente');
      }

      // Lista para armazenar os buffers dos PDFs gerados
      const allChunks: Buffer[] = [];

      // Gerar um PDF para cada NFS-e
      for (const nfseData of nfseDataList) {
        // Garantir que não é um erro nos dados da NFS-e
        if (nfseData instanceof Error) {
          throw new Error('Dados da NFS-e são inválidos ou corrompidos.');
        }

        // Extrair dados necessários
        const prestadorData = this.getPrestadorData(nfseData.PrestadorServico);
        const tomadorData = this.getTomadorData(nfseData.TomadorServico);
        const servicoData = this.getServicoData(nfseData.Servico);

        const docDefinition: TDocumentDefinitions = {
          content: [
            {
              text: `NFS-e Número: ${this.getFirstValue(nfseData.Numero)}`,
              style: 'header',
            },
            {
              text: `Código de Verificação: ${this.getFirstValue(nfseData.CodigoVerificacao)}`,
              style: 'subheader',
            },
            {
              text: `Data de Emissão: ${this.getFirstValue(nfseData.DataEmissao)}`,
              style: 'subheader',
            },
            {
              text: `Prestador: ${prestadorData.razaoSocial}`,
              style: 'content',
            },
            { text: `CNPJ Prestador: ${prestadorData.cnpj}`, style: 'content' },
            { text: `Tomador: ${tomadorData.razaoSocial}`, style: 'content' },
            { text: `CNPJ Tomador: ${tomadorData.cnpj}`, style: 'content' },
            {
              text: `Valor dos Serviços: ${servicoData.valorServicos}`,
              style: 'content',
            },
            { text: `Valor do ISS: ${servicoData.valorIss}`, style: 'content' },
            {
              text: `Discriminação: ${servicoData.discriminacao}`,
              style: 'content',
            },
          ],
          styles: {
            header: { fontSize: 18, bold: true, font: 'Helvetica' },
            subheader: { fontSize: 14, italics: true, font: 'Helvetica' },
            content: { fontSize: 12, font: 'Helvetica' },
          },
          defaultStyle: { font: 'Helvetica' },
        };

        await new Promise<void>((resolve, reject) => {
          try {
            if (!this.printer) {
              throw new Error('PdfMake não foi inicializado corretamente');
            }

            const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
            const chunks: Buffer[] = [];

            pdfDoc.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });

            pdfDoc.on('end', () => {
              const result = Buffer.concat(chunks);
              allChunks.push(result); // Armazenar o PDF gerado
              resolve();
            });

            pdfDoc.on('error', (error: Error) => {
              this.logger.error('Erro na geração do PDF:', error);
              reject(error);
            });

            pdfDoc.end();
          } catch (error) {
            this.logger.error('Erro ao criar documento PDF:', error);
            reject(
              error instanceof Error ? error : new Error('Erro desconhecido'),
            );
          }
        });
      }

      // Concatenar todos os PDFs gerados e retornar
      return Buffer.concat(allChunks);
    } catch (error) {
      this.logger.error('Erro geral ao gerar PDF:', error);
      throw error instanceof Error ? error : new Error('Erro ao gerar PDF');
    }
  }
}
