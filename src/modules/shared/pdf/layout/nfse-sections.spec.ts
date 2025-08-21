/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { AssetLoader, IMunicipioResolver } from './asset-loader';
import { NfseSections } from './nfse-sections';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { PdfLayouts } from './layouts';
import { Content } from '../types';

function vfFirstImpl(v: unknown): unknown {
  return Array.isArray(v) ? (v.length ? v[0] : undefined) : v;
}
function vfFormatDateImpl(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number'
    ? `DATE:${String(v)}`
    : '';
}
function vfFormatDocImpl(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number'
    ? `DOC:${String(v)}`
    : '';
}
function vfFormatCepImpl(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number'
    ? `CEP:${String(v)}`
    : 'CEP:';
}

jest.mock('./value-format', () => ({
  ValueFormat: {
    first: jest.fn(vfFirstImpl),
    formatDate: jest.fn(vfFormatDateImpl),
    formatCpfCnpj: jest.fn(vfFormatDocImpl),
    formatCep: jest.fn(vfFormatCepImpl),
  },
}));

jest.mock('./asset-loader', () => {
  const resolveNameMock: jest.MockedFunction<
    (c?: string | string[]) => Promise<string>
  > = jest.fn((c?: string | string[]) =>
    Promise.resolve(typeof c === 'string' && c.length ? c : 'Não informado'),
  );

  const preloadMock: jest.MockedFunction<() => Promise<void>> = jest.fn(() =>
    Promise.resolve(),
  );

  const fromEnvMock = jest.fn(() => new MunicipioResolver());

  class MunicipioResolver {
    static fromEnv = fromEnvMock;

    preload = preloadMock;
    resolveName = resolveNameMock;
  }

  return {
    __esModule: true,
    MunicipioResolver,
    resolveNameMock,
    preloadMock,
    fromEnvMock,
  };
});

const { resolveNameMock } = jest.requireMock('./asset-loader');

jest.mock('./layouts', () => ({
  PdfLayouts: {
    headerLogo: { colWidth: 120, hPadding: 10, maxHeight: 40 },
    numberInner: { numberInner: true },
    header: { header: true },
    gridNoOuter: { gridNoOuter: true },
    innerCompact: { innerCompact: true },
    outerBox: { outerBox: true },
  },
}));

type PdfTable = { widths?: unknown[]; body: unknown[][] };
type PdfTableWrapper = { table: PdfTable };
type PdfStackWrapper = { stack: Array<{ text?: unknown }> };
type PdfTextCell = { text?: unknown };
type PdfImageCell = { fit?: unknown; image?: unknown };
type PdfRowSpanCell = { rowSpan?: unknown };

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function hasTable(x: unknown): x is PdfTableWrapper {
  return (
    isObject(x) &&
    isObject(x.table) &&
    Array.isArray((x.table as PdfTable).body)
  );
}
function getTable(x: unknown): PdfTable | undefined {
  return hasTable(x) ? x.table : undefined;
}
function hasStack(x: unknown): x is PdfStackWrapper {
  return isObject(x) && Array.isArray(x.stack);
}
function getStackTexts(x: unknown): string[] {
  if (!hasStack(x)) return [];
  const stack = x.stack;
  return stack
    .map((s) =>
      isObject(s) && typeof (s as PdfTextCell).text === 'string'
        ? ((s as PdfTextCell).text as string)
        : undefined,
    )
    .filter((t): t is string => typeof t === 'string');
}
function getText(x: unknown): string | undefined {
  return isObject(x) && typeof (x as PdfTextCell).text === 'string'
    ? ((x as PdfTextCell).text as string)
    : undefined;
}
function getFit(x: unknown): [number, number] | undefined {
  if (!isObject(x)) return undefined;
  const fit = (x as PdfImageCell).fit;
  if (
    Array.isArray(fit) &&
    fit.length === 2 &&
    typeof fit[0] === 'number' &&
    typeof fit[1] === 'number'
  ) {
    return fit as [number, number];
  }
  return undefined;
}
function getRowSpan(x: unknown): number | undefined {
  if (!isObject(x)) return undefined;
  const rs = (x as PdfRowSpanCell).rowSpan;
  return typeof rs === 'number' ? rs : undefined;
}

type MockAssetLoader = {
  loadMunicipioLogoDataUrl: jest.MockedFunction<(c: string) => string>;
  loadBrandLogoDataUrl: jest.MockedFunction<() => string>;
};

describe('NfseSections', () => {
  let assets: MockAssetLoader;
  let sections: NfseSections;

  const baseData = (overrides: Partial<NfseData> = {}): NfseData =>
    ({
      ChaveNFe: { NumeroNFe: '123', CodigoVerificacao: 'ABCD-123' },
      ChaveRPS: { NumeroRPS: 'RPS-9' },
      DataEmissaoNFe: '2024-10-10',
      EnderecoPrestador: {
        Cidade: 'Curitiba',
        TipoLogradouro: 'Av.',
        Logradouro: 'Brasil',
        NumeroEndereco: '100',
        Bairro: 'Centro',
        UF: 'PR',
        CEP: '80000-000',
      },
      EnderecoTomador: {
        Cidade: 'São Paulo',
        TipoLogradouro: 'Rua',
        Logradouro: 'Paulista',
        NumeroEndereco: '2000',
        ComplementoEndereco: 'CJ 1501',
        Bairro: 'Bela Vista',
        UF: 'SP',
        CEP: '01311-000',
      },
      RazaoSocialPrestador: 'ACME LTDA',
      CPFCNPJPrestador: { CNPJ: '11222333000144' },
      RazaoSocialTomador: 'CLIENTE S/A',
      CPFCNPJTomador: { CPF: '12345678901' },
      Discriminacao: 'Service description here',
      ValorServicos: '1000,00',
      ValorTotalRecebido: 'Não informado',
      AliquotaServicos: '2,00',
      ValorISS: '20,00',
      ...overrides,
    }) as unknown as NfseData;

  beforeEach(() => {
    jest.clearAllMocks();

    const { resolveNameMock, preloadMock } = jest.requireMock('./asset-loader');

    resolveNameMock.mockImplementation((c?: string | string[]) =>
      Promise.resolve(typeof c === 'string' && c.length ? c : 'Não informado'),
    );
    preloadMock.mockResolvedValue(undefined);

    const loadMunicipioLogoDataUrl: jest.MockedFunction<(c: string) => string> =
      jest.fn((c: string) => 'data:image/png;base64,LOGO');
    const loadBrandLogoDataUrl: jest.MockedFunction<() => string> = jest.fn(
      () => 'data:image/png;base64,BRAND',
    );

    assets = {
      loadMunicipioLogoDataUrl,
      loadBrandLogoDataUrl,
    };

    const municipio: IMunicipioResolver = {
      preload: preloadMock,
      resolveName: resolveNameMock,
    };

    sections = new NfseSections(assets as unknown as AssetLoader, municipio);
  });

  describe('header', () => {
    it('should build header with municipality logo, org/dept/title and number box', async () => {
      const n = baseData();
      const content: Content = await sections.header(n);

      expect(assets.loadMunicipioLogoDataUrl).toHaveBeenCalledWith('Curitiba');
      const table = getTable(content);
      expect(table).toBeDefined();
      expect(table?.widths).toEqual([
        PdfLayouts.headerLogo.colWidth,
        '*',
        NfseSections.NUMBER_BOX_WIDTH,
      ]);

      const row0 = Array.isArray(table?.body?.[0]) ? table.body[0] : [];
      const stackTexts = getStackTexts(row0[1]);
      expect(stackTexts).toContain('SECRETARIA MUNICIPAL DAS FINANÇAS');
      expect(stackTexts).toContain('NOTA FISCAL ELETRÔNICA DE SERVIÇO - NFS-e');
      expect(
        stackTexts.some((t) => t.includes('PREFEITURA MUNICIPAL DE CURITIBA')),
      ).toBe(true);

      const nbTable = getTable(row0[2]);
      const numberBoxValue = getText(nbTable?.body?.[1]?.[0]);
      expect(numberBoxValue).toBe('123');

      const logoFit = getFit(row0[0]);
      expect(logoFit?.[0]).toBe(
        PdfLayouts.headerLogo.colWidth - PdfLayouts.headerLogo.hPadding * 2,
      );
      expect(logoFit?.[1]).toBe(PdfLayouts.headerLogo.maxHeight);
    });

    it('should fallback to "SEU MUNICÍPIO" when municipality name is missing/unknown', async () => {
      resolveNameMock.mockResolvedValueOnce('Não informado');

      const n = baseData({
        EnderecoPrestador: {
          Cidade: undefined,
        } as unknown as NfseData['EnderecoPrestador'],
      });
      const content: Content = await sections.header(n);

      const table = getTable(content);
      const row0 = Array.isArray(table?.body?.[0]) ? table.body[0] : [];
      const stackTexts = getStackTexts(row0[1]);

      expect(stackTexts).toContain('PREFEITURA MUNICIPAL DE SEU MUNICÍPIO');
    });
  });

  describe('meta', () => {
    it('should produce meta table with formatted date, verification code and RPS number', () => {
      const n = baseData();
      const content: Content = sections.meta(n);

      const outer = getTable(content);
      const innerWrapper = outer?.body?.[0]?.[0];
      const inner = getTable(innerWrapper);
      const rowValues = Array.isArray(inner?.body?.[1]) ? inner.body[1] : [];

      expect(getText(rowValues[0])).toBe('DATE:2024-10-10'); // formatted date
      expect(getText(rowValues[1])).toBe('ABCD-123'); // verification code
      expect(getText(rowValues[2])).toBe('RPS-9'); // RPS number
    });
  });

  describe('prestador', () => {
    it('should render provider section with brand logo cell and formatted fields', async () => {
      const n = baseData();
      const content: Content = await sections.prestador(n);

      const table = getTable(content);
      const sectionTitle = getText(table?.body?.[0]?.[0]);
      expect(sectionTitle).toBe('Dados do Prestador de Serviços');

      const inner = getTable(table?.body?.[1]?.[0]);
      const rows = Array.isArray(inner?.body) ? inner.body : [];

      expect(getText(rows[0]?.[0])).toBe('Razão Social/Nome');
      expect(getText(rows[0]?.[1])).toBe('ACME LTDA');
      expect(getText(rows[1]?.[1])).toBe('DOC:11222333000144');

      const addr = getText(rows[2]?.[1]) ?? '';
      expect(addr).toMatch(/Brasil/);
      expect(addr).toMatch(/100/);

      const muniUf = getText(rows[4]?.[1]) ?? '';
      expect(muniUf).toMatch(/Curitiba/i);
      expect(muniUf).toMatch(/PR$/);

      const brandCell = rows[0]?.[2];
      expect(getRowSpan(brandCell)).toBe(6);
      expect(assets.loadBrandLogoDataUrl).toHaveBeenCalledTimes(1);
    });

    it('should fallback brand cell to empty text if brand logo is not available', async () => {
      assets.loadBrandLogoDataUrl.mockReturnValueOnce('');
      const n = baseData();
      const content: Content = await sections.prestador(n);

      const table = getTable(content);
      const inner = getTable(table?.body?.[1]?.[0]);
      const rows = Array.isArray(inner?.body) ? inner.body : [];
      const brandCell = rows[0]?.[2];

      expect(getRowSpan(brandCell)).toBe(6);
      expect(getText(brandCell)).toBe('');
    });
  });

  describe('tomador', () => {
    it('should render customer section and compose address including complement', async () => {
      const n = baseData();
      const content: Content = await sections.tomador(n);

      const table = getTable(content);
      const sectionTitle = getText(table?.body?.[0]?.[0]);
      expect(sectionTitle).toBe('Dados do Tomador de Serviços');

      const inner = getTable(table?.body?.[1]?.[0]);
      const rows = Array.isArray(inner?.body) ? inner.body : [];

      expect(getText(rows[0]?.[1])).toBe('CLIENTE S/A');
      expect(getText(rows[1]?.[1])).toBe('DOC:12345678901');

      const addr = getText(rows[2]?.[1]) ?? '';
      expect(addr).toMatch(/Paulista/);
      expect(addr).toMatch(/2000/);
      expect(addr).toMatch(/CJ 1501/);

      const muniUf = getText(rows[4]?.[1]) ?? '';
      expect(muniUf).toMatch(/São Paulo/i);
      expect(muniUf).toMatch(/SP$/);
    });
  });

  describe('discriminacao', () => {
    it('should render description of services or fallback to dash', () => {
      const n1 = baseData({ Discriminacao: 'Consulting services' });
      const c1: Content = sections.discriminacao(n1);
      const t1 = getTable(c1);
      expect(getText(t1?.body?.[1]?.[0])).toBe('Consulting services');

      const n2 = baseData({ Discriminacao: undefined as unknown as string });
      const c2: Content = sections.discriminacao(n2);
      const t2 = getTable(c2);
      expect(getText(t2?.body?.[1]?.[0])).toBe('—');
    });
  });

  describe('valores', () => {
    it('should fallback ValorTotalRecebido to ValorServicos when "Não informado"', () => {
      const n = baseData({
        ValorServicos: '1500,00',
        ValorTotalRecebido: 'Não informado',
        AliquotaServicos: '3,00',
        ValorISS: '45,00',
      });
      const content: Content = sections.valores(n);

      const table = getTable(content);
      const row = Array.isArray(table?.body?.[1]) ? table.body[1] : [];

      expect(getText(row[0])).toBe('1500,00');
      expect(getText(row[1])).toBe('1500,00');
      expect(getText(row[2])).toBe('3,00');
      expect(getText(row[3])).toBe('45,00');
    });

    it('should use provided ValorTotalRecebido when informed', () => {
      const n = baseData({
        ValorServicos: '1000,00',
        ValorTotalRecebido: '900,00',
        AliquotaServicos: '2,00',
        ValorISS: '20,00',
      });
      const content: Content = sections.valores(n);

      const table = getTable(content);
      const row = Array.isArray(table?.body?.[1]) ? table.body[1] : [];

      expect(getText(row[0])).toBe('1000,00');
      expect(getText(row[1])).toBe('900,00');
    });
  });

  describe('avisos', () => {
    it('should include standard italic warnings stack', () => {
      const content: Content = sections.avisos();
      const texts = getStackTexts(content);

      expect(texts.length).toBe(2);
      expect(texts[0]?.toLowerCase()).toMatch(/autenticidade/);
      expect(texts[1]?.toLowerCase()).toMatch(/emitido eletronicamente/);
    });
  });
});
