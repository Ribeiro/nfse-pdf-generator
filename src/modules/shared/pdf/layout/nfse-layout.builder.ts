// src/modules/shared/pdf/layout/nfse-layout.builder.ts
import { NfseData } from 'src/modules/nfse/types/nfse.types';
import type {
  FontDictionary,
  TDocumentDefinitions,
} from '../types/pdfmake.types';
import { nfseStyles } from './nfse-styles';
import { MunicipioResolver } from './municipio.resolver';

export interface BuildOptions {
  logo?: string;
  header?: {
    orgName?: string; // se não vier, cai no fallback com nome do município (IBGE)
    deptName?: string;
    docTitle?: string;
  };
}

type ValoresObj = {
  ValorServicos?: string | string[];
  ValorDeducoes?: string | string[];
  ValorPis?: string | string[];
  ValorCofins?: string | string[];
  ValorInss?: string | string[];
  ValorIr?: string | string[];
  ValorCsll?: string | string[];
  IssRetido?: string | string[];
  ValorIss?: string | string[];
  OutrasRetencoes?: string | string[];
  BaseCalculo?: string | string[];
  Aliquota?: string | string[];
  ValorLiquidoNfse?: string | string[];
  ValorIssRetido?: string | string[];
  DescontoCondicionado?: string | string[];
  DescontoIncondicionado?: string | string[];
};

export class NfseLayoutBuilder {
  // Dicionário de fontes centralizado e tipado
  public static readonly fonts: FontDictionary = {
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

  constructor(private readonly opts: BuildOptions = {}) {}

  private first(value: string | string[] | undefined): string {
    if (!value) return 'Não informado';
    return Array.isArray(value) ? value[0] : value;
  }

  private getPrestadorData(prestador: NfseData['PrestadorServico']) {
    if (Array.isArray(prestador)) {
      return {
        razaoSocial: this.first(prestador[0]?.RazaoSocial),
        cnpj: this.first(prestador[0]?.IdentificacaoPrestador?.[0]?.Cnpj),
      };
    }
    return {
      razaoSocial: this.first(prestador.RazaoSocial),
      cnpj: this.first(prestador.IdentificacaoPrestador?.Cnpj),
    };
  }

  private getTomadorData(tomador: NfseData['TomadorServico']) {
    if (Array.isArray(tomador)) {
      return {
        razaoSocial: this.first(tomador[0]?.RazaoSocial),
        cnpj: this.first(
          tomador[0]?.IdentificacaoTomador?.[0]?.CpfCnpj?.[0]?.Cnpj ??
            tomador[0]?.IdentificacaoTomador?.[0]?.CpfCnpj?.[0]?.Cpf,
        ),
      };
    }
    return {
      razaoSocial: this.first(tomador.RazaoSocial),
      cnpj: this.first(
        tomador.IdentificacaoTomador?.CpfCnpj?.Cnpj ??
          tomador.IdentificacaoTomador?.CpfCnpj?.Cpf,
      ),
    };
  }

  private getValores(servico: NfseData['Servico']) {
    const s = Array.isArray(servico) ? servico[0] : servico;
    const raw = s?.Valores as unknown as ValoresObj | ValoresObj[] | undefined;
    const v = Array.isArray(raw) ? raw[0] : raw;

    return {
      valorServicos: this.first(v?.ValorServicos),
      baseCalculo: this.first(v?.BaseCalculo),
      aliquota: this.first(v?.Aliquota),
      valorIss: this.first(v?.ValorIss),
      issRetido: this.first(v?.IssRetido),
      descontos: this.first(v?.DescontoIncondicionado),
      deducoes: this.first(v?.ValorDeducoes),
      valorLiquido: this.first(v?.ValorLiquidoNfse),
    };
  }

  private sectionHeader(n: NfseData) {
    const numeroNfse = this.first(n.Numero);

    const org = Array.isArray(n.OrgaoGerador)
      ? n.OrgaoGerador[0]
      : n.OrgaoGerador;
    const municipioNomeRaw = MunicipioResolver.resolveName(
      org?.CodigoMunicipio,
    );
    const municipioNome =
      municipioNomeRaw && municipioNomeRaw !== 'Não informado'
        ? municipioNomeRaw
        : 'SEU MUNICÍPIO';

    const orgName =
      this.opts.header?.orgName ?? `PREFEITURA MUNICIPAL DE ${municipioNome}`;
    const deptName =
      this.opts.header?.deptName ?? 'SECRETARIA MUNICIPAL DAS FINANÇAS';
    const docTitle =
      this.opts.header?.docTitle ?? 'NOTA FISCAL ELETRÔNICA DE SERVIÇO - NFS-e';

    return {
      margin: [0, 0, 0, 10],
      table: {
        widths: [90, '*', 130],
        body: [
          [
            {
              image: this.opts.logo || undefined,
              width: 70,
              height: 50,
              alignment: 'left',
              border: [false, false, false, false],
            },
            {
              border: [false, false, false, false],
              stack: [
                { text: orgName, style: 'titleSmall', alignment: 'center' },
                { text: deptName, style: 'titleSmall', alignment: 'center' },
                {
                  text: docTitle,
                  style: 'title',
                  alignment: 'center',
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              layout: 'lightHorizontalLines',
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: 'Número da NFS-e',
                      style: 'boxHeader',
                      alignment: 'center',
                    },
                  ],
                  [
                    {
                      text: numeroNfse || '—',
                      style: 'boxValue',
                      alignment: 'center',
                    },
                  ],
                ],
              },
            },
          ],
        ],
      },
      layout: 'noBorders',
    };
  }

  private sectionMeta(n: NfseData) {
    const dtEmissao = this.first(n.DataEmissao);
    const competencia = this.first(n.Competencia);
    const codVerif = this.first(n.CodigoVerificacao);
    const rps = Array.isArray(n.IdentificacaoRps)
      ? n.IdentificacaoRps[0]
      : n.IdentificacaoRps;
    const numRps = this.first(rps?.Numero);

    return {
      margin: [0, 0, 0, 10],
      table: {
        widths: ['*', '*', '*', '*'],
        body: [
          [
            { text: 'Data e Hora da Emissão', style: 'th' },
            { text: 'Competência', style: 'th' },
            { text: 'Código de Verificação', style: 'th' },
            { text: 'Número do RPS', style: 'th' },
          ],
          [
            { text: dtEmissao || '—', style: 'td' },
            { text: competencia || '—', style: 'td' },
            { text: codVerif || '—', style: 'td' },
            { text: numRps || '—', style: 'td' },
          ],
        ],
      },
    };
  }

  private sectionPrestador(n: NfseData) {
    const prest = this.getPrestadorData(n.PrestadorServico);
    const org = Array.isArray(n.OrgaoGerador)
      ? n.OrgaoGerador[0]
      : n.OrgaoGerador;

    const municipioNome = MunicipioResolver.resolveName(org?.CodigoMunicipio);
    const uf = this.first(org?.Uf);

    return {
      margin: [0, 0, 0, 10],
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Dados do Prestador de Serviços', style: 'sectionHeader' }],
          [
            {
              table: {
                widths: ['25%', '75%'],
                body: [
                  [
                    { text: 'Razão Social/Nome', style: 'th2' },
                    { text: prest.razaoSocial, style: 'td2' },
                  ],
                  [
                    { text: 'CNPJ/CPF', style: 'th2' },
                    { text: prest.cnpj, style: 'td2' },
                  ],
                  [
                    { text: 'Município / UF', style: 'th2' },
                    { text: `${municipioNome} / ${uf}`, style: 'td2' },
                  ],
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
    };
  }

  private sectionTomador(n: NfseData) {
    const toma = this.getTomadorData(n.TomadorServico);
    return {
      margin: [0, 0, 0, 10],
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Dados do Tomador de Serviços', style: 'sectionHeader' }],
          [
            {
              table: {
                widths: ['25%', '75%'],
                body: [
                  [
                    { text: 'Razão Social/Nome', style: 'th2' },
                    { text: toma.razaoSocial, style: 'td2' },
                  ],
                  [
                    { text: 'CNPJ/CPF', style: 'th2' },
                    { text: toma.cnpj, style: 'td2' },
                  ],
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        ],
      },
    };
  }

  private sectionDiscriminacao(n: NfseData) {
    const discri = Array.isArray(n.Servico)
      ? this.first(n.Servico[0]?.Discriminacao)
      : this.first(n.Servico?.Discriminacao);

    return {
      margin: [0, 0, 0, 10],
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Discriminação dos Serviços', style: 'sectionHeader' }],
          [{ text: discri || '—', style: 'td2' }],
        ],
      },
      layout: 'lightHorizontalLines',
    };
  }

  private sectionValores(n: NfseData) {
    const vals = this.getValores(n.Servico);
    return {
      margin: [0, 0, 0, 8],
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            { text: 'Valor dos Serviços (R$)', style: 'th' },
            { text: 'Base de Cálculo (R$)', style: 'th' },
            { text: 'Alíquota (%)', style: 'th' },
            { text: 'Valor do ISS (R$)', style: 'th' },
          ],
          [
            { text: vals.valorServicos || '—', style: 'td' },
            { text: vals.baseCalculo || '—', style: 'td' },
            { text: vals.aliquota || '—', style: 'td' },
            { text: vals.valorIss || '—', style: 'td' },
          ],
        ],
      },
    };
  }

  private sectionAvisos() {
    return {
      margin: [0, 6, 0, 0],
      fontSize: 9,
      italics: true,
      text: [
        '1 - A autenticidade desta Nota Fiscal pode ser validada no portal do município utilizando o Código de Verificação. ',
        '2 - Este documento foi emitido eletronicamente.',
      ],
    };
  }

  public buildNotaContent(n: NfseData) {
    return [
      this.sectionHeader(n),
      this.sectionMeta(n),
      this.sectionPrestador(n),
      this.sectionTomador(n),
      this.sectionDiscriminacao(n),
      this.sectionValores(n),
      this.sectionAvisos(),
    ];
  }

  public buildDocument(nfseDataList: NfseData[]): TDocumentDefinitions {
    const content: any[] = [];
    nfseDataList.forEach((n, i) => {
      content.push(...this.buildNotaContent(n));
      if (i < nfseDataList.length - 1)
        content.push({ text: ' ', pageBreak: 'after' });
    });

    return {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 28],
      content,
      styles: nfseStyles,
      defaultStyle: { font: 'Helvetica', fontSize: 11 },
    };
  }
}
