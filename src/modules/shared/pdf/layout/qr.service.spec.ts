/* eslint-disable @typescript-eslint/unbound-method */
import { NfseQrService } from './qr.service';
import { ValueFormat as Fmt } from './value-format';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';

jest.mock('./value-format', () => ({
  ValueFormat: {
    first: jest.fn((v: unknown) =>
      typeof v === 'string' && v.length > 0 ? v : 'Não informado',
    ),
    decodeBase64ToUtf8: jest.fn((s: string) => s),
  },
}));

type ChaveNFe = NonNullable<NfseData['ChaveNFe']>;
type ChaveRPS = NonNullable<NfseData['ChaveRPS']>;

function makeData(overrides: Partial<NfseData> = {}): NfseData {
  const base: NfseData = {
    ChaveNFe: {
      NumeroNFe: '123',
      CodigoVerificacao: 'ABCD',
      InscricaoPrestador: '98765',
    } as ChaveNFe,
    ChaveRPS: {
      NumeroRPS: 'RPS-1',
      InscricaoPrestador: '55555',
    } as ChaveRPS,
    Assinatura: 'c29tZSBiYXNlNjQ=',
  } as unknown as NfseData;

  return { ...base, ...overrides } as NfseData;
}

describe('NfseQrService', () => {
  let svc: NfseQrService;
  const firstMock = Fmt.first as jest.MockedFunction<typeof Fmt.first>;
  const decodeMock = Fmt.decodeBase64ToUtf8 as jest.MockedFunction<
    typeof Fmt.decodeBase64ToUtf8
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new NfseQrService();
  });

  describe('buildQrValue - URL construction', () => {
    it('builds the SP Prefeitura URL when inscricao, nf and verificacao are present on NFe', () => {
      const n = makeData();
      const out = svc.buildQrValue(n);

      const inscricao = String(n.ChaveNFe?.InscricaoPrestador ?? '');
      const nf = String(n.ChaveNFe?.NumeroNFe ?? '');
      const verificacao = String(n.ChaveNFe?.CodigoVerificacao ?? '');

      const expected =
        `${NfseQrService.PREF_SP_URL}?` +
        `inscricao=${encodeURIComponent(inscricao)}` +
        `&nf=${encodeURIComponent(nf)}` +
        `&verificacao=${encodeURIComponent(verificacao)}`;

      expect(out).toBe(expected);
      expect(firstMock).not.toHaveBeenCalled();
      expect(decodeMock).not.toHaveBeenCalled();
    });

    it('uses RPS.inscricao when NFe.inscricao is missing', () => {
      const n = makeData({
        ChaveNFe: {
          NumeroNFe: '999',
          CodigoVerificacao: 'ZZZ9',
          // InscricaoPrestador intentionally omitted
        } as unknown as ChaveNFe,
        ChaveRPS: {
          InscricaoPrestador: '424242',
        } as unknown as ChaveRPS,
      });

      const out = svc.buildQrValue(n);
      const expected = `${NfseQrService.PREF_SP_URL}?inscricao=424242&nf=999&verificacao=ZZZ9`;

      expect(out).toBe(expected);
    });

    it('returns null when URL data is absent and Assinatura is "Não informado"', () => {
      firstMock.mockReturnValueOnce('Não informado');

      const n = makeData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: undefined,
        } as unknown as ChaveNFe,
        ChaveRPS: {
          InscricaoPrestador: undefined,
        } as unknown as ChaveRPS,
        Assinatura: undefined,
      });

      const out = svc.buildQrValue(n);
      expect(out).toBeNull();
      expect(firstMock).toHaveBeenCalledTimes(1);
      expect(decodeMock).not.toHaveBeenCalled();
    });
  });

  describe('buildQrValue - Assinatura decoding path', () => {
    it('decodes base64 Assinatura and trims it', () => {
      firstMock.mockReturnValueOnce('BASE64_RAW');
      decodeMock.mockReturnValueOnce('  https://ok  ');

      const n = makeData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: undefined,
        } as unknown as ChaveNFe,
        ChaveRPS: {
          InscricaoPrestador: undefined,
        } as unknown as ChaveRPS,
        Assinatura: 'BASE64_RAW',
      });

      const out = svc.buildQrValue(n);
      expect(firstMock).toHaveBeenCalledWith('BASE64_RAW');
      expect(decodeMock).toHaveBeenCalledWith('BASE64_RAW');
      expect(out).toBe('https://ok');
    });

    it('returns the raw value when decoded string is empty after trim', () => {
      firstMock.mockReturnValueOnce('RAW_B64');
      decodeMock.mockReturnValueOnce('   ');

      const n = makeData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: undefined,
        } as unknown as ChaveNFe,
        ChaveRPS: {
          InscricaoPrestador: undefined,
        } as unknown as ChaveRPS,
        Assinatura: 'RAW_B64',
      });

      const out = svc.buildQrValue(n);
      expect(out).toBe('RAW_B64');
    });

    it('handles a non-empty decoded payload without URL characters', () => {
      firstMock.mockReturnValueOnce('ANY_B64');
      decodeMock.mockReturnValueOnce('SOME TEXT');

      const n = makeData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: undefined,
        } as unknown as ChaveNFe,
        ChaveRPS: {
          InscricaoPrestador: undefined,
        } as unknown as ChaveRPS,
        Assinatura: 'ANY_B64',
      });

      const out = svc.buildQrValue(n);
      expect(out).toBe('SOME TEXT');
    });
  });
});
