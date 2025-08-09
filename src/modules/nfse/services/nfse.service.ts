import { Injectable } from '@nestjs/common';
import { PdfService } from '../../shared/pdf/pdf.service';
import { NfseDto } from '../dto/nfse.dto';
import { Parser } from 'xml2js';

interface NfseData {
  Numero: string | string[];
  CodigoVerificacao: string | string[];
  DataEmissao: string | string[];
  PrestadorServico:
    | {
        RazaoSocial: string | string[];
        IdentificacaoPrestador: {
          Cnpj: string | string[];
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

interface NfseParsed {
  Nfse: {
    InfNfse: NfseData[];
  };
}

@Injectable()
export class NfseService {
  constructor(private readonly pdfService: PdfService) {}

  async processarNfse(nfseDto: NfseDto): Promise<Buffer> {
    const xml = nfseDto.xml;
    const parser = new Parser({ explicitArray: false });
    const parsedXml: NfseParsed = await this.parseXml(xml, parser);

    const nfseDataList = Array.isArray(parsedXml.Nfse.InfNfse)
      ? parsedXml.Nfse.InfNfse
      : [parsedXml.Nfse.InfNfse];

    return await this.pdfService.gerarPdf(nfseDataList);
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
