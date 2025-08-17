import { NfseData } from 'src/modules/nfse/types/nfse.types';
import type {
  FontDictionary,
  TDocumentDefinitions,
} from '../types/pdfmake.types';
import { nfseStyles } from './nfse-styles';
import { MunicipioResolver } from './municipio.resolver';
import type { Content, TableLayout } from 'pdfmake/interfaces';
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
    vLineWidth: () => 0, // sem linhas verticais internas
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
  private static readonly qrSize = 80;

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
    return {
      valorServicos: this.first(n.ValorServicos),
      valorTotalRecebido: this.first(n.ValorTotalRecebido),
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
    const municipio = this.first(end?.Cidade); // IBGE
    const uf = this.first(end?.UF);
    const cep = this.first(end?.CEP);

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
    const municipio = this.first(end?.Cidade); // IBGE
    const uf = this.first(end?.UF);
    const cep = this.first(end?.CEP);

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

  private getQrAbsolutePosition() {
    const w = NfseLayoutBuilder.A4.width;
    const h = NfseLayoutBuilder.A4.height;
    const { right, bottom } = NfseLayoutBuilder.margins;
    const size = NfseLayoutBuilder.qrSize;
    return { x: w - right - size, y: h - bottom - size };
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

  private buildQrNode(assinatura?: string): Content | null {
    const raw = this.first(assinatura);
    if (raw === 'Não informado') return null;

    const decoded = this.decodeBase64ToUtf8(raw).trim();
    const qrValue = decoded.length > 0 ? decoded : raw;

    const pos = this.getQrAbsolutePosition();
    const node: Content = {
      qr: qrValue,
      fit: NfseLayoutBuilder.qrSize,
      absolutePosition: { x: pos.x, y: pos.y },
    };
    return node;
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
    const competencia = '—'; // não existe no layout atual
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
                widths: ['*', '*', '*', NfseLayoutBuilder.NUMBER_BOX_WIDTH],
                body: [
                  [
                    { text: 'Emissão', style: 'th' },
                    { text: 'Competência', style: 'th' },
                    { text: 'Código de Verificação', style: 'th' },
                    { text: 'Número do RPS', style: 'th' },
                  ],
                  [
                    { text: dtEmissao || '—', style: 'td' },
                    { text: competencia, style: 'td' },
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
    const municipioUF = `${this.first(
      MunicipioResolver.resolveName(end.municipio),
    )} / ${this.first(end.uf)}`;

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
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
                    { text: 'Endereço', style: 'th2' },
                    { text: end.endereco, style: 'td2' },
                  ],
                  [
                    { text: 'Bairro', style: 'th2' },
                    { text: end.bairro, style: 'td2' },
                  ],
                  [
                    { text: 'Município / UF', style: 'th2' },
                    { text: municipioUF, style: 'td2' },
                  ],
                  [
                    { text: 'CEP', style: 'th2' },
                    { text: end.cep, style: 'td2' },
                  ],
                ],
              },
              layout: 'lightHorizontalLines',
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

    return {
      margin: [0, 0, 0, 10] as MarginsTuple,
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
                  [
                    { text: 'Endereço', style: 'th2' },
                    { text: end.endereco, style: 'td2' },
                  ],
                  [
                    { text: 'Bairro', style: 'th2' },
                    { text: end.bairro, style: 'td2' },
                  ],
                  [
                    { text: 'Município / UF', style: 'th2' },
                    { text: municipioUF, style: 'td2' },
                  ],
                  [
                    { text: 'CEP', style: 'th2' },
                    { text: end.cep, style: 'td2' },
                  ],
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionDiscriminacao(n: NfseData): Content {
    const discri = this.first(n.Discriminacao);
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
    return {
      margin: [0, 0, 0, 8] as MarginsTuple,
      table: {
        widths: ['*'],
        body: [
          [
            {
              table: {
                widths: ['25%', '25%', '25%', '25%'],
                body: [
                  [
                    { text: 'Valor dos Serviços (R$)', style: 'th' },
                    { text: 'Valor Total Recebido (R$)', style: 'th' },
                    { text: 'Alíquota (%)', style: 'th' },
                    { text: 'Valor do ISS (R$)', style: 'th' },
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
            },
          ],
        ],
      },
      layout: NfseLayoutBuilder.outerBoxLayout,
    };
  }

  private sectionAvisos(): Content {
    return {
      margin: [0, 6, 0, 0] as MarginsTuple,
      fontSize: 9,
      italics: true,
      stack: [
        {
          text: '1 - A autenticidade desta Nota Fiscal pode ser validada no portal do município utilizando o Código de Verificação.',
        },
        {
          text: '2 - Este documento foi emitido eletronicamente.',
          margin: [0, 4, 0, 0] as MarginsTuple,
        },
      ],
    };
  }

  // ====== Pipeline ======
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

    const qrNode = this.buildQrNode(n.Assinatura);
    if (qrNode) sections.push(qrNode);

    return sections;
  }

  public buildDocument(nfseDataList: NfseData[]): TDocumentDefinitions {
    const content: Content[] = [];

    nfseDataList.forEach((n, i) => {
      const notaContent = this.buildNotaContent(n);
      content.push(...notaContent);
      if (i < nfseDataList.length - 1) {
        content.push({ text: ' ', pageBreak: 'after' });
      }
    });

    return {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 28] as MarginsTuple,
      content,
      styles: nfseStyles,
      defaultStyle: { font: 'Helvetica', fontSize: 11 },
    };
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
}
