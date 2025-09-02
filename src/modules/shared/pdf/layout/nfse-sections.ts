import { PdfLayouts } from './layouts';
import { ValueFormat as Fmt } from './value-format';
import { type AssetLoader, type IMunicipioResolver } from './asset-loader';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { Content, TableCell } from '../types';
import {
  ASSET_LOADER_TOKEN,
  MUNICIPIO_RESOLVER_TOKEN,
} from '../providers/nfse-infrastructure.provider';
import { Inject, Injectable } from '@nestjs/common';

type MarginsTuple = [number, number, number, number];

@Injectable()
export class NfseSections {
  static readonly NUMBER_BOX_WIDTH = 140;

  constructor(
    @Inject(ASSET_LOADER_TOKEN)
    private readonly assets: AssetLoader,
    @Inject(MUNICIPIO_RESOLVER_TOKEN)
    private readonly municipio: IMunicipioResolver,
  ) {}

  async header(n: NfseData): Promise<Content> {
    const numeroNfse = Fmt.first(n.ChaveNFe?.NumeroNFe);

    const municipioNomeRaw = await this.municipio.resolveName(
      n.EnderecoPrestador?.Cidade,
    );
    const municipioNome =
      municipioNomeRaw && municipioNomeRaw !== 'Não informado'
        ? municipioNomeRaw
        : 'SEU MUNICÍPIO';

    const orgName = `Prefeitura do Município de ${municipioNome}`;
    const deptName = 'Secretaria Municipal da Fazenda';
    const docTitle = 'Nota Fiscal de Serviço Eletrônica';

    const logoFitWidth =
      PdfLayouts.headerLogo.colWidth - PdfLayouts.headerLogo.hPadding * 2;

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: [
          PdfLayouts.headerLogo.colWidth,
          '*',
          NfseSections.NUMBER_BOX_WIDTH,
        ],
        body: [
          [
            {
              image: this.assets.loadMunicipioLogoDataUrl(
                n.EnderecoPrestador?.Cidade ?? '',
              ),
              fit: [logoFitWidth, PdfLayouts.headerLogo.maxHeight],
              alignment: 'left',
              margin: [0, 0, 0, 0],
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
                  fontSize: 9,
                  lineHeight: 1.1,
                  alignment: 'center',
                  margin: [0, 2, 0, 0] as MarginsTuple,
                },
              ],
            },
            {
              layout: PdfLayouts.numberInner,
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: 'Número da Nota',
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
      layout: PdfLayouts.header,
    };
  }

  meta(n: NfseData): Content {
    const dtEmissao = Fmt.formatDate(Fmt.first(n.DataEmissaoNFe));
    const codVerif = Fmt.first(n.ChaveNFe?.CodigoVerificacao);

    const KV = (k: string, v?: string) => ({
      text: [{ text: `${k}: `, bold: true }, { text: v && v.trim() ? v : '—' }],
      style: 'td',
      fontSize: 8,
      lineHeight: 0.95,
      margin: [2, 1, 2, 1],
      noWrap: false,
      alignment: 'left',
    });

    return {
      margin: [0, 0, 0, 6] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              table: {
                widths: ['50%', '50%'],
                body: [
                  [
                    KV('Emissão', dtEmissao),
                    KV('Código de Verificação', codVerif),
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
        ],
      },
      layout: PdfLayouts.outerBox,
    };
  }

  async prestador(n: NfseData): Promise<Content> {
    const razaoSocial = Fmt.first(n.RazaoSocialPrestador);
    const doc = Fmt.first(n.CPFCNPJPrestador?.CNPJ ?? n.CPFCNPJPrestador?.CPF);
    const end = this.enderecoPrestador(n);

    const municipioNome = await this.municipio.resolveName(end.municipio);
    const municipioUF = `${Fmt.first(municipioNome)} / ${Fmt.first(end.uf)}`;
    const InscricaoMunicipalPrestador = Fmt.first(
      n.ChaveNFe?.InscricaoPrestador,
    );

    const H = (t: string): TableCell =>
      ({
        text: t,
        style: 'th2',
        fontSize: 8,
        lineHeight: 1.05,
        margin: [0, 1, 0, 1],
        noWrap: true,
      }) as TableCell;
    const V = (t: string): TableCell =>
      ({
        text: t,
        style: 'td2',
        fontSize: 8,
        lineHeight: 1.05,
        margin: [0, 1, 0, 1],
      }) as TableCell;

    const BRAND_BOX_WIDTH = 180;
    const BRAND_MAX_HEIGHT = 80;
    const brandLogo = this.assets.loadBrandLogoDataUrl();

    const brandCell: TableCell = brandLogo
      ? {
          rowSpan: 6,
          margin: [8, 6, 8, 6],
          stack: [
            {
              image: brandLogo,
              fit: [BRAND_BOX_WIDTH - 16, BRAND_MAX_HEIGHT],
              alignment: 'center',
            },
          ],
        }
      : ({ rowSpan: 6, text: '' } as TableCell);

    const filler: TableCell = { text: '' } as TableCell;

    return {
      margin: [0, 0, 0, 6],
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: 'Prestador de Serviços',
              style: 'sectionHeader',
              margin: [0, 2, 0, 2],
            },
          ],
          [
            {
              table: {
                widths: [140, '*', BRAND_BOX_WIDTH],
                body: [
                  [H('Nome/Razão Social'), V(razaoSocial), brandCell],
                  [H('CPF/CNPJ'), V(Fmt.formatCpfCnpj(doc)), filler],
                  [
                    H('Inscrição Municipal'),
                    V(InscricaoMunicipalPrestador),
                    filler,
                  ],
                  [H('Endereço'), V(end.endereco), filler],
                  [H('Bairro'), V(end.bairro), filler],
                  [H('Município / UF'), V(municipioUF), filler],
                  [H('CEP'), V(end.cep), filler],
                ] as TableCell[][],
              },
              layout: PdfLayouts.innerCompact,
            },
          ],
        ],
      },
      layout: PdfLayouts.outerBox,
    };
  }

  async tomador(n: NfseData): Promise<Content> {
    const razao = Fmt.first(n.RazaoSocialTomador);
    const doc = Fmt.first(n.CPFCNPJTomador?.CNPJ ?? n.CPFCNPJTomador?.CPF);
    const end = this.enderecoTomador(n);

    const municipioNome = await this.municipio.resolveName(end.municipio);
    const municipioUF = `${Fmt.first(municipioNome)} / ${Fmt.first(end.uf)}`;

    const H = (t: string) => ({
      text: t,
      style: 'th2',
      fontSize: 8,
      lineHeight: 1.05,
      margin: [0, 1, 0, 1],
      noWrap: true,
    });
    const V = (t: string) => ({
      text: t,
      style: 'td2',
      fontSize: 8,
      lineHeight: 1.05,
      margin: [0, 1, 0, 1],
    });

    return {
      margin: [0, 0, 0, 6] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: 'Tomador de Serviços',
              style: 'sectionHeader',
              margin: [0, 2, 0, 2],
            },
          ],
          [
            {
              table: {
                widths: ['25%', '75%'],
                body: [
                  [H('Nome/Razão Social'), V(razao)],
                  [H('CPF/CNPJ'), V(Fmt.formatCpfCnpj(doc))],
                  [H('Inscrição Municipal'), V('')],
                  [H('Endereço'), V(end.endereco)],
                  [H('Bairro'), V(end.bairro)],
                  [H('Município / UF'), V(municipioUF)],
                  [H('CEP'), V(end.cep)],
                ],
              },
              layout: PdfLayouts.innerCompact,
            },
          ],
        ],
      },
      layout: PdfLayouts.outerBox,
    };
  }

  discriminacao(n: NfseData): Content {
    const discri = Fmt.first(n.Discriminacao);
    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Discriminação dos Serviços', style: 'sectionHeader' }],
          [{ text: discri || '—', style: 'td2' }],
        ],
      },
      layout: PdfLayouts.outerBox,
    };
  }

  valores(n: NfseData): Content {
    const valorServicos = Fmt.formatDecimal(n.ValorServicos);
    const totalRecebido = Fmt.formatDecimal(n.ValorTotalRecebido);

    const isValidTotalRecebido =
      totalRecebido &&
      totalRecebido !== 'Não informado' &&
      totalRecebido.trim() !== '';

    const valorINSS = n.ValorINSS ? Fmt.formatDecimal(n.ValorINSS) : '-';
    const valorIRRF = n.ValorIRRF ? Fmt.formatDecimal(n.ValorIRRF) : '-';
    const valorCSLL = n.ValorCSLL ? Fmt.formatDecimal(n.ValorCSLL) : '-';
    const valorCOFINS = n.ValorCOFINS ? Fmt.formatDecimal(n.ValorCOFINS) : '-';
    const valorPIS = n.ValorPIS ? Fmt.formatDecimal(n.ValorPIS) : '-';

    const codigoServico = Fmt.first(n.CodigoServico);
    const discriminacaoServico =
      n.DiscriminacaoServico ??
      'Fornecimento e administração de vales-refeição, vales-alimentação, vales-transporte e similares';

    const valorDeducoes = Fmt.formatDecimal(n.ValorDeducoes || '0');
    const baseCalculo = Fmt.formatDecimal(n.BaseCalculo || '0');
    const aliquota = Fmt.formatDecimal(
      (Number(n.AliquotaServicos || 0) * 100).toString(),
    );
    const valorISS = Fmt.formatDecimal(n.ValorISS || '0');
    const valorCredito = Fmt.formatDecimal(n.ValorCredito || '0');

    const municipioPrestacao = n.MunicipioPrestacao ?? '-';
    const numeroInscricaoObra = n.NumeroInscricaoObra ?? '-';
    const valorAproximadoTributos = n.ValorAproximadoTributos ?? '';

    const H = (t: string) => ({
      text: t,
      style: 'th',
      fontSize: 7,
      lineHeight: 0.8,
      noWrap: true,
      alignment: 'center',
      margin: [1, 0.5, 1, 0.5],
    });

    const V = (t: string) => ({
      text: t || '—',
      style: 'td',
      fontSize: 7,
      lineHeight: 0.8,
      alignment: 'center',
      margin: [1, 0.5, 1, 0.5],
    });

    return {
      margin: [0, 0, 0, 4] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              table: {
                widths: ['50%', '50%'],
                body: [
                  [
                    {
                      text: `VALOR TOTAL DO SERVIÇO = R$ ${valorServicos || '0,00'}`,
                      style: 'th',
                      fontSize: 8.5,
                      alignment: 'center',
                      bold: true,
                      margin: [1, 1, 1, 1],
                    },
                    {
                      text: isValidTotalRecebido
                        ? `VALOR TOTAL RECEBIDO = R$ ${totalRecebido}`
                        : `VALOR TOTAL RECEBIDO = R$ ${valorServicos || '0,00'}`,
                      style: 'th',
                      fontSize: 8.5,
                      alignment: 'center',
                      bold: true,
                      margin: [1, 1, 1, 1],
                    },
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
          [
            {
              table: {
                widths: ['20%', '20%', '20%', '20%', '20%'],
                body: [
                  [
                    H('INSS (R$)'),
                    H('IRRF (R$)'),
                    H('CSLL (R$)'),
                    H('COFINS (R$)'),
                    H('PIS/PASEP (R$)'),
                  ],
                  [
                    V(valorINSS !== '0,00' ? valorINSS : '-'),
                    V(valorIRRF !== '0,00' ? valorIRRF : '-'),
                    V(valorCSLL !== '0,00' ? valorCSLL : '-'),
                    V(valorCOFINS !== '0,00' ? valorCOFINS : '-'),
                    V(valorPIS !== '0,00' ? valorPIS : '-'),
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
          [
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: 'Código do Serviço',
                      style: 'th',
                      fontSize: 8,
                      alignment: 'left',
                      margin: [2, 1, 2, 1],
                    },
                  ],
                  [
                    {
                      text:
                        codigoServico && discriminacaoServico
                          ? `${codigoServico} - ${discriminacaoServico}`
                          : codigoServico || '—',
                      style: 'td',
                      fontSize: 8,
                      alignment: 'left',
                      margin: [2, 1, 2, 1],
                      bold: true,
                    },
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
          [
            {
              table: {
                widths: ['20%', '20%', '20%', '20%', '20%'],
                body: [
                  [
                    H('Valor Total das Deduções (R$)'),
                    H('Base de Cálculo (R$)'),
                    H('Alíquota (%)'),
                    H('Valor do ISS (R$)'),
                    H('Crédito (R$)'),
                  ],
                  [
                    V(valorDeducoes),
                    V(baseCalculo),
                    V(aliquota ? `${aliquota}%` : '—'),
                    V(valorISS),
                    V(valorCredito),
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
          [
            {
              table: {
                widths: ['33%', '33%', '34%'],
                body: [
                  [
                    H('Município da Prestação do Serviço'),
                    H('Número Inscrição da Obra'),
                    H('Valor Aproximado dos Tributos / Fonte'),
                  ],
                  [
                    V(municipioPrestacao),
                    V(numeroInscricaoObra),
                    V(valorAproximadoTributos),
                  ],
                ],
              },
              layout: PdfLayouts.gridNoOuter,
            },
          ],
        ],
      },
      layout: PdfLayouts.outerBox,
    };
  }
  avisos(n: NfseData): Content {
    const nroRps = Fmt.first(n.ChaveRPS?.NumeroRPS);
    const serieRps = Fmt.first(n.ChaveRPS?.SerieRPS);
    const dtEmissaoRps = Fmt.formatDate(n.DataEmissaoRPS);
    return {
      margin: [0, 4, 0, 0] as MarginsTuple,
      fontSize: 8.5,
      lineHeight: 1.1,
      italics: true,
      stack: [
        {
          text: '(1) Esta NFS-e foi emitida com respaldo na Lei nº 14.097/2005.',
        },
        {
          text: `(2) Esta NFS-e substitui o RPS Nº ${nroRps} Série ${serieRps}, emitido em ${dtEmissaoRps}`,
          margin: [0, 3, 0, 0] as MarginsTuple,
        },
      ],
    };
  }

  private enderecoPrestador(n: NfseData) {
    const e = n.EnderecoPrestador;
    const log = Fmt.first(e?.Logradouro);
    const num = Fmt.first(e?.NumeroEndereco);
    const bairro = Fmt.first(e?.Bairro);
    const municipio = Fmt.first(e?.Cidade);
    const uf = Fmt.first(e?.UF);
    let cep = Fmt.first(e?.CEP);
    cep = Fmt.formatCep(cep);
    const logCompleto = [log]
      .filter((s) => s !== 'Não informado')
      .join(' ')
      .trim();
    let endereco = logCompleto.length ? logCompleto : 'Não informado';
    if (num !== 'Não informado')
      endereco += (endereco !== 'Não informado' ? ', ' : '') + num;
    return { endereco, bairro, municipio, uf, cep };
  }

  private enderecoTomador(n: NfseData) {
    const e = n.EnderecoTomador;
    const log = Fmt.first(e?.Logradouro);
    const num = Fmt.first(e?.NumeroEndereco);
    const comp = Fmt.first(e?.ComplementoEndereco);
    const bairro = Fmt.first(e?.Bairro);
    const municipio = Fmt.first(e?.Cidade);
    const uf = Fmt.first(e?.UF);
    let cep = Fmt.first(e?.CEP);
    cep = Fmt.formatCep(cep);
    const logCompleto = [log]
      .filter((s) => s !== 'Não informado')
      .join(' ')
      .trim();
    let endereco = logCompleto.length ? logCompleto : 'Não informado';
    if (num !== 'Não informado')
      endereco += (endereco !== 'Não informado' ? ', ' : '') + num;
    if (comp !== 'Não informado') endereco += ' - ' + comp;
    return { endereco, bairro, municipio, uf, cep };
  }
}
