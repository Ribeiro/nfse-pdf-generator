import { NfseData } from 'src/modules/nfse/types/nfse.types';
import type {
  FontDictionary,
  TDocumentDefinitions,
} from '../types/pdfmake.types';
import { nfseStyles } from './nfse-styles';
import { MunicipioResolver } from './municipio.resolver';
import type { Content, TableLayout, TableCell } from 'pdfmake/interfaces';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildOptions {
  header?: {
    orgName?: string;
    deptName?: string;
    docTitle?: string;
  };
}

type MarginsTuple = [number, number, number, number];

type LayoutNode = Readonly<{
  table?: Readonly<{
    body?: ReadonlyArray<ReadonlyArray<unknown>>;
    widths?: ReadonlyArray<string | number>;
  }>;
}>;

export class NfseLayoutBuilder {
  private static readonly NUMBER_BOX_WIDTH = 140;
  private static readonly CEP_REGEX: RegExp = /^(\d{2})(\d{3})(\d{3})$/;
  private static readonly ONLY_DIGIT_REGEX = /\D/g;
  private static readonly CPF_REGEX = /^(\d{3})(\d{3})(\d{3})(\d{2})$/;
  private static readonly CNPJ_REGEX = /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/;
  private static readonly PREFEITURA_SP_URL =
    'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx';

  private static readonly innerCompactLayout: TableLayout = {
    hLineWidth: (i: number, node: unknown) => {
      const rows = NfseLayoutBuilder.tableRowsCount(node);
      return i === 0 || i === rows ? 0 : 0.5;
    },
    vLineWidth: () => 0,
    hLineColor: () => '#E0E0E0',

    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 1.5,
    paddingBottom: () => 1.5,
  };

  private static readonly headerLayout: TableLayout = {
    hLineWidth: (i: number, node: unknown) => {
      const rows = NfseLayoutBuilder.tableRowsCount(node);
      return i === 0 || i === rows ? 1 : 0;
    },
    vLineWidth: (i: number, node: unknown) => {
      const cols = NfseLayoutBuilder.tableColsCount(node);
      return i === 0 || i === cols || i === cols - 1 ? 1 : 0;
    },
    hLineColor: () => '#BFBFBF',
    vLineColor: () => '#BFBFBF',
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  };

  private static readonly numberInnerLayout: TableLayout = {
    hLineWidth: (i: number) => {
      return i === 1 ? 1 : 0;
    },
    vLineWidth: () => 0,
    hLineColor: () => '#BFBFBF',
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  };

  private static readonly headerLogo = {
    colWidth: 100,
    maxHeight: 60,
    hPadding: 0,
  };

  private static readonly A4 = { width: 595.28, height: 841.89 };
  private static readonly margins = {
    left: 20,
    top: 20,
    right: 20,
    bottom: 28,
  };
  private static readonly qrSize = 64;

  private static is2DArray(
    val: unknown,
  ): val is ReadonlyArray<ReadonlyArray<unknown>> {
    return Array.isArray(val) && val.every((r) => Array.isArray(r));
  }

  private static tableRowsCount(node: unknown): number {
    const t = (node as LayoutNode).table;
    const body = t?.body;
    return Array.isArray(body) ? body.length : 0;
  }

  private static tableColsCount(node: unknown): number {
    const t = (node as LayoutNode).table;
    const widths = t?.widths;
    if (Array.isArray(widths)) return widths.length;

    const bodyUnknown: unknown = t?.body;
    if (NfseLayoutBuilder.is2DArray(bodyUnknown) && bodyUnknown.length > 0) {
      return bodyUnknown[0].length;
    }
    return 0;
  }

  private static readonly outerBoxLayout: TableLayout = {
    hLineWidth: (i: number, node: unknown) => {
      const rows = NfseLayoutBuilder.tableRowsCount(node);
      return i === 0 || i === rows ? 1 : 0;
    },
    vLineWidth: (i: number, node: unknown) => {
      const cols = NfseLayoutBuilder.tableColsCount(node);
      return i === 0 || i === cols ? 1 : 0;
    },
    hLineColor: () => '#BFBFBF',
    vLineColor: () => '#BFBFBF',
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  };

  private static readonly gridNoOuterLayout: TableLayout = {
    hLineWidth: (i: number, node: unknown) => {
      const rows = NfseLayoutBuilder.tableRowsCount(node);
      return i === 0 || i === rows ? 0 : 1;
    },
    vLineWidth: (i: number, node: unknown) => {
      const cols = NfseLayoutBuilder.tableColsCount(node);
      return i === 0 || i === cols ? 0 : 1;
    },
    hLineColor: () => '#E0E0E0',
    vLineColor: () => '#E0E0E0',
  };

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

  private first(value?: string): string {
    const v = (value ?? '').toString().trim();
    return v.length > 0 ? v : 'Não informado';
  }

  private getPrestadorData(n: NfseData) {
    const razaoSocial = this.first(n.RazaoSocialPrestador);
    const doc = n.CPFCNPJPrestador?.CNPJ ?? n.CPFCNPJPrestador?.CPF;
    return { razaoSocial, cnpj: this.first(doc) };
  }

  private getTomadorData(n: NfseData) {
    const razaoSocial = this.first(n.RazaoSocialTomador);
    const doc = n.CPFCNPJTomador?.CNPJ ?? n.CPFCNPJTomador?.CPF;
    return { razaoSocial, cnpj: this.first(doc) };
  }

  private getValores(n: NfseData) {
    const valorServicos = this.first(n.ValorServicos);
    const totalRecebido = this.first(n.ValorTotalRecebido);

    return {
      valorServicos,
      valorTotalRecebido:
        totalRecebido !== 'Não informado' ? totalRecebido : valorServicos,
      aliquota: this.first(n.AliquotaServicos),
      valorIss: this.first(n.ValorISS),
    };
  }

  private formatEnderecoPrestador(n: NfseData) {
    const end = n.EnderecoPrestador;
    const tipoLog = this.first(end?.TipoLogradouro);
    const log = this.first(end?.Logradouro);
    const num = this.first(end?.NumeroEndereco);
    const bairro = this.first(end?.Bairro);
    const municipio = this.first(end?.Cidade);
    const uf = this.first(end?.UF);
    let cep = this.first(end?.CEP);
    cep = this.formatCep(cep);

    const logCompleto = [tipoLog, log]
      .filter((s) => s !== 'Não informado')
      .join(' ')
      .trim();
    let endereco = logCompleto.length ? logCompleto : 'Não informado';
    if (num !== 'Não informado')
      endereco += (endereco !== 'Não informado' ? ', ' : '') + num;

    return { endereco, bairro, municipio, uf, cep };
  }

  private formatEnderecoTomador(n: NfseData) {
    const end = n.EnderecoTomador;
    const tipoLog = this.first(end?.TipoLogradouro);
    const log = this.first(end?.Logradouro);
    const num = this.first(end?.NumeroEndereco);
    const comp = this.first(end?.ComplementoEndereco);
    const bairro = this.first(end?.Bairro);
    const municipio = this.first(end?.Cidade);
    const uf = this.first(end?.UF);
    let cep = this.first(end?.CEP);
    cep = this.formatCep(cep);

    const logCompleto = [tipoLog, log]
      .filter((s) => s !== 'Não informado')
      .join(' ')
      .trim();
    let endereco = logCompleto.length ? logCompleto : 'Não informado';
    if (num !== 'Não informado')
      endereco += (endereco !== 'Não informado' ? ', ' : '') + num;
    if (comp !== 'Não informado') endereco += ' - ' + comp;

    return { endereco, bairro, municipio, uf, cep };
  }

  private normalizeB64(s: string): string {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = t.length % 4;
    if (pad) t += '='.repeat(4 - pad);
    return t;
  }

  private decodeBase64ToUtf8(b64: string): string {
    const g = globalThis as unknown as {
      Buffer?: typeof import('buffer').Buffer;
      atob?: (data: string) => string;
    };

    try {
      if (g.Buffer) {
        return g.Buffer.from(this.normalizeB64(b64), 'base64').toString(
          'utf-8',
        );
      }
    } catch {
      /* ignore */
    }

    try {
      if (typeof g.atob === 'function') {
        const bin = g.atob(this.normalizeB64(b64));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        if (typeof TextDecoder !== 'undefined') {
          return new TextDecoder('utf-8').decode(bytes);
        }
        return bin;
      }
    } catch {
      /* ignore */
    }

    return b64;
  }

  private buildQrValue(n: NfseData): string | null {
    const inscricao =
      n.ChaveNFe?.InscricaoPrestador || n.ChaveRPS?.InscricaoPrestador;
    const nf = n.ChaveNFe?.NumeroNFe;
    const verificacao = n.ChaveNFe?.CodigoVerificacao;

    if (inscricao && nf && verificacao) {
      const params = new URLSearchParams({
        inscricao: String(inscricao),
        nf: String(nf),
        verificacao: String(verificacao),
      });
      return `${NfseLayoutBuilder.PREFEITURA_SP_URL}?${params.toString()}`;
    }

    const raw = this.first(n.Assinatura);
    if (raw === 'Não informado') return null;
    const decoded = this.decodeBase64ToUtf8(raw).trim();
    return decoded.length > 0 ? decoded : raw;
  }

  private sectionHeader(n: NfseData): Content {
    const numeroNfse = this.first(n.ChaveNFe?.NumeroNFe);
    const municipioNomeRaw = MunicipioResolver.resolveName(
      n.EnderecoPrestador?.Cidade,
    );
    const municipioNome =
      municipioNomeRaw && municipioNomeRaw !== 'Não informado'
        ? municipioNomeRaw
        : 'SEU MUNICÍPIO';

    const orgName =
      this.opts.header?.orgName ??
      `PREFEITURA MUNICIPAL DE ${municipioNome.toUpperCase()}`;
    const deptName =
      this.opts.header?.deptName ?? 'SECRETARIA MUNICIPAL DAS FINANÇAS';
    const docTitle =
      this.opts.header?.docTitle ?? 'NOTA FISCAL ELETRÔNICA DE SERVIÇO - NFS-e';

    const logoFitWidth =
      NfseLayoutBuilder.headerLogo.colWidth -
      NfseLayoutBuilder.headerLogo.hPadding * 2;

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: [
          NfseLayoutBuilder.headerLogo.colWidth,
          '*',
          NfseLayoutBuilder.NUMBER_BOX_WIDTH,
        ],
        body: [
          [
            {
              image: this.loadLogoDataUrl(n.EnderecoPrestador?.Cidade ?? ''),
              fit: [logoFitWidth, NfseLayoutBuilder.headerLogo.maxHeight],
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
              layout: NfseLayoutBuilder.numberInnerLayout,
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: 'Número',
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
      layout: NfseLayoutBuilder.headerLayout,
    };
  }

  private sectionMeta(n: NfseData): Content {
    const dtEmissao = this.first(n.DataEmissaoNFe);
    const dtEmissaoFormatada = this.formatDate(dtEmissao);
    const codVerif = this.first(n.ChaveNFe?.CodigoVerificacao);
    const numRps = this.first(n.ChaveRPS?.NumeroRPS);

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              table: {
                widths: ['*', '*', NfseLayoutBuilder.NUMBER_BOX_WIDTH],
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
                    { text: dtEmissaoFormatada || '—', style: 'td' },
                    { text: codVerif || '—', style: 'td' },
                    { text: numRps || '—', style: 'td' },
                  ],
                ],
              },
              layout: NfseLayoutBuilder.gridNoOuterLayout,
            },
          ],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionPrestador(n: NfseData): Content {
    const prest = this.getPrestadorData(n);
    const end = this.formatEnderecoPrestador(n);
    const municipioUF = `${this.first(MunicipioResolver.resolveName(end.municipio))} / ${this.first(end.uf)}`;

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

    const brandLogo = this.loadRaioLogoDataUrl();
    const BRAND_BOX_WIDTH = 180;
    const BRAND_MAX_HEIGHT = 80;

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
                  [H('Razão Social/Nome'), V(prest.razaoSocial), brandCell],
                  [H('CNPJ/CPF'), V(this.formatCpfCnpj(prest.cnpj)), filler],
                  [H('Endereço'), V(end.endereco), filler],
                  [H('Bairro'), V(end.bairro), filler],
                  [H('Município / UF'), V(municipioUF), filler],
                  [H('CEP'), V(end.cep), filler],
                ] as TableCell[][],
              },
              layout: NfseLayoutBuilder.innerCompactLayout,
            },
          ],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionTomador(n: NfseData): Content {
    const toma = this.getTomadorData(n);
    const end = this.formatEnderecoTomador(n);
    const municipioUF = `${this.first(
      MunicipioResolver.resolveName(end.municipio),
    )} / ${this.first(end.uf)}`;

    const H = (t: string) => ({
      text: t,
      style: 'th2',
      fontSize: 9,
      lineHeight: 1.05,
      margin: [0, 1, 0, 1] as MarginsTuple,
      noWrap: true,
    });
    const V = (t: string) => ({
      text: t,
      style: 'td2',
      fontSize: 9,
      lineHeight: 1.05,
      margin: [0, 1, 0, 1] as MarginsTuple,
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
                  [H('Razão Social/Nome'), V(toma.razaoSocial)],
                  [H('CNPJ/CPF'), V(this.formatCpfCnpj(toma.cnpj))],
                  [H('Endereço'), V(end.endereco)],
                  [H('Bairro'), V(end.bairro)],
                  [H('Município / UF'), V(municipioUF)],
                  [H('CEP'), V(end.cep)],
                ],
              },
              layout: NfseLayoutBuilder.innerCompactLayout,
            },
          ],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionDiscriminacao(n: NfseData): Content {
    let discri = this.first(n.Discriminacao);
    discri =
      'A presente Nota Fiscal de Serviços refere-se à prestação de serviços de consultoria especializada em processos de gestão corporativa, com foco em análise estratégica de negócios, revisão de fluxos operacionais e implementação de melhorias contínuas. Inclui a elaboração de relatórios técnicos detalhados, reuniões presenciais e virtuais com gestores e equipes envolvidas, levantamento de requisitos, desenho de soluções e acompanhamento de indicadores-chave de desempenho. Abrange, ainda, atividades de suporte técnico-administrativo, orientação para utilização de ferramentas digitais de produtividade, treinamentos básicos para colaboradores e suporte remoto em caráter emergencial. Foram considerados no escopo os serviços de análise de dados financeiros e operacionais, geração de dashboards gerenciais, emissão de recomendações estratégicas e apoio à tomada de decisão em áreas críticas. O pacote contempla, também, atendimento a dúvidas e esclarecimentos posteriores à entrega, assegurando a correta absorção dos resultados e a continuidade do uso das soluções propostas, garantindo eficiência e maior valor agregado às atividades do tomador.';
    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Discriminação dos Serviços', style: 'sectionHeader' }],
          [{ text: discri || '—', style: 'td2' }],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionValores(n: NfseData): Content {
    const vals = this.getValores(n);

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
      layout: NfseLayoutBuilder.gridNoOuterLayout,
    };
  }

  private sectionAvisos(): Content {
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

  public buildNotaContent(n: NfseData): Content[] {
    const sections: Content[] = [
      this.sectionHeader(n),
      this.sectionMeta(n),
      this.sectionPrestador(n),
      this.sectionTomador(n),
      this.sectionDiscriminacao(n),
      this.sectionValores(n),
      this.sectionAvisos(),
    ];

    return sections;
  }

  public buildDocument(
    nfseDataList: NfseData[],
    cancelled: boolean = false,
  ): TDocumentDefinitions {
    const content: Content[] = [];

    nfseDataList.forEach((n, i) => {
      const notaContent = this.buildNotaContent(n);
      content.push(...notaContent);
      if (i < nfseDataList.length - 1) {
        content.push({ text: ' ', pageBreak: 'after' });
      }
    });

    const first = nfseDataList[0];

    const footerBoxHeight = NfseLayoutBuilder.qrSize + 12;
    const bottomMargin = Math.max(footerBoxHeight, 36);

    const doc: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [18, 16, 18, bottomMargin] as [
        number,
        number,
        number,
        number,
      ],
      content,
      styles: nfseStyles,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      footer: (currentPage: number): Content => {
        if (currentPage !== 1) return { text: '' };
        const qrValue = first ? this.buildQrValue(first) : null;
        if (!qrValue) return { text: '' };

        return {
          margin: [18, 2, 18, 6],
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              qr: qrValue,
              fit: NfseLayoutBuilder.qrSize,
              alignment: 'right',
            },
          ],
          columnGap: 10,
        };
      },
      ...(cancelled ? { header: this.buildCancelledOverlayHeader() } : {}),
    };

    return doc;
  }

  private loadLogoDataUrl(ibgeCode: string): string | undefined {
    const candidates = [
      path.resolve(
        __dirname,
        `../../../../assets/logo-prefeitura-${ibgeCode}.png`,
      ),
      path.resolve(
        process.cwd(),
        `dist/assets/logo-prefeitura-${ibgeCode}.png`,
      ),
      path.resolve(process.cwd(), `assets/logo-prefeitura-${ibgeCode}.png`),
    ];

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const base64 = fs.readFileSync(filePath).toString('base64');
          return `data:image/png;base64,${base64}`;
        }
      } catch (err) {
        console.error(err);
      }
    }

    return undefined;
  }

  private formatDate(value?: string): string {
    if (!value) return '—';
    const dt = new Date(value);

    const date = dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const time = dt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${date} ${time}`;
  }

  private loadRaioLogoDataUrl(): string | undefined {
    const candidates = [
      path.resolve(__dirname, '../../../../assets/logo-raio.png'),
      path.resolve(process.cwd(), 'dist/assets/logo-raio.png'),
      path.resolve(process.cwd(), 'assets/logo-raio.png'),
    ];

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const base64 = fs.readFileSync(filePath).toString('base64');
          return `data:image/png;base64,${base64}`;
        }
      } catch (err) {
        console.error(err);
      }
    }
    return undefined;
  }

  private formatCep(value: string | number): string {
    let cep = String(value).replace(NfseLayoutBuilder.ONLY_DIGIT_REGEX, '');
    cep = cep.padStart(8, '0');
    return cep.replace(NfseLayoutBuilder.CEP_REGEX, '$1.$2-$3');
  }

  private formatCpfCnpj(value: string | number): string {
    const digits = String(value).replace(
      NfseLayoutBuilder.ONLY_DIGIT_REGEX,
      '',
    );

    if (digits.length === 11) {
      return digits.replace(NfseLayoutBuilder.CPF_REGEX, '$1.$2.$3-$4');
    } else if (digits.length === 14) {
      return digits.replace(NfseLayoutBuilder.CNPJ_REGEX, '$1.$2.$3/$4-$5');
    }

    return String(value);
  }

  private buildCancelledOverlayHeader() {
    return (
      _currentPage: number,
      _pageCount: number,
      pageSize: { width: number; height: number },
    ): Content => {
      const cx = pageSize.width / 2;
      const cy = pageSize.height / 2;

      const angle = 35;
      const text = 'CANCELADA';
      const fontSize = 110;
      const fill = '#d32f2f';
      const opacity = 0.7;

      const svg = `
      <svg width="${pageSize.width}" height="${pageSize.height}">
        <g transform="translate(${cx},${cy}) rotate(${angle})">
          <text x="0" y="0"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="${fontSize}"
                font-family="Helvetica"
                font-weight="700"
                fill="${fill}"
                opacity="${opacity}">
            ${text}
          </text>
        </g>
      </svg>
    `;

      return { svg, absolutePosition: { x: 0, y: 0 } };
    };
  }
}
