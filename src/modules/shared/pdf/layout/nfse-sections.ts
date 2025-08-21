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

    const orgName = `PREFEITURA MUNICIPAL DE ${municipioNome.toUpperCase()}`;
    const deptName = 'SECRETARIA MUNICIPAL DAS FINANÇAS';
    const docTitle = 'NOTA FISCAL ELETRÔNICA DE SERVIÇO - NFS-e';

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
                  fontSize: 11,
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
                  [{ text: 'Número', style: 'boxHeader', alignment: 'center' }],
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
    const numRps = Fmt.first(n.ChaveRPS?.NumeroRPS);

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              table: {
                widths: ['*', '*', NfseSections.NUMBER_BOX_WIDTH],
                body: [
                  [
                    { text: 'Emissão', style: 'th' },
                    { text: 'Código de Verificação', style: 'th' },
                    {
                      text: 'Número do RPS',
                      style: 'th',
                      bold: false,
                      fontSize: 10,
                      color: '#555',
                    },
                  ],
                  [
                    { text: dtEmissao || '—', style: 'td' },
                    { text: codVerif || '—', style: 'td' },
                    { text: numRps || '—', style: 'td' },
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

    const H = (t: string): TableCell =>
      ({
        text: t,
        style: 'th2',
        fontSize: 9,
        lineHeight: 1.05,
        margin: [0, 1, 0, 1],
        noWrap: true,
      }) as TableCell;
    const V = (t: string): TableCell =>
      ({
        text: t,
        style: 'td2',
        fontSize: 9,
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
              text: 'Dados do Prestador de Serviços',
              style: 'sectionHeader',
              margin: [0, 2, 0, 2],
            },
          ],
          [
            {
              table: {
                widths: [140, '*', BRAND_BOX_WIDTH],
                body: [
                  [H('Razão Social/Nome'), V(razaoSocial), brandCell],
                  [H('CNPJ/CPF'), V(Fmt.formatCpfCnpj(doc)), filler],
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
      fontSize: 9,
      lineHeight: 1.05,
      margin: [0, 1, 0, 1],
      noWrap: true,
    });
    const V = (t: string) => ({
      text: t,
      style: 'td2',
      fontSize: 9,
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
              text: 'Dados do Tomador de Serviços',
              style: 'sectionHeader',
              margin: [0, 2, 0, 2],
            },
          ],
          [
            {
              table: {
                widths: ['25%', '75%'],
                body: [
                  [H('Razão Social/Nome'), V(razao)],
                  [H('CNPJ/CPF'), V(Fmt.formatCpfCnpj(doc))],
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
    const valorServicos = Fmt.first(n.ValorServicos);
    const totalRecebido = Fmt.first(n.ValorTotalRecebido);
    const vals = {
      valorServicos,
      valorTotalRecebido:
        totalRecebido !== 'Não informado' ? totalRecebido : valorServicos,
      aliquota: Fmt.first(n.AliquotaServicos),
      valorIss: Fmt.first(n.ValorISS),
    };
    const H = (t: string) => ({
      text: t,
      style: 'th',
      fontSize: 10,
      noWrap: true,
    });

    return {
      margin: [0, 0, 0, 8] as MarginsTuple,
      table: {
        widths: ['30%', '30%', '20%', '20%'],
        body: [
          [
            H('Valor dos Serviços (R$)'),
            H('Valor Total Recebido (R$)'),
            H('Alíquota (%)'),
            H('Valor do ISS (R$)'),
          ],
          [
            { text: vals.valorServicos || '—', style: 'td' },
            { text: vals.valorTotalRecebido || '—', style: 'td' },
            { text: vals.aliquota || '—', style: 'td' },
            { text: vals.valorIss || '—', style: 'td' },
          ],
        ],
      },
      layout: PdfLayouts.gridNoOuter,
    };
  }

  avisos(): Content {
    return {
      margin: [0, 4, 0, 0] as MarginsTuple,
      fontSize: 8.5,
      lineHeight: 1.1,
      italics: true,
      stack: [
        {
          text: '1 - A autenticidade desta Nota Fiscal pode ser validada no portal do município utilizando o Código de Verificação.',
        },
        {
          text: '2 - Este documento foi emitido eletronicamente.',
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
