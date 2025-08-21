/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/modules/shared/pdf/layout/qr.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NfseQrService } from './qr.service';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { PREFEITURA_URL_TOKEN } from '../providers/prefeitura-url.provider';

jest.mock('./value-format', () => ({
  ValueFormat: {
    first: jest.fn(),
    decodeBase64ToUtf8: jest.fn(),
  },
}));

const { ValueFormat: MockValueFormat } = jest.requireMock('./value-format');

function createNfseData(overrides: Partial<NfseData> = {}): NfseData {
  return {
    ChaveNFe: {
      NumeroNFe: '123456',
      CodigoVerificacao: 'ABC123',
      InscricaoPrestador: '987654321',
    },
    ChaveRPS: {
      NumeroRPS: 'RPS-789',
      InscricaoPrestador: '123456789',
    },
    Assinatura: 'aGVsbG8gd29ybGQ=', // "hello world" em base64
    ...overrides,
  } as unknown as NfseData;
}

describe('NfseQrService', () => {
  let service: NfseQrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NfseQrService,
        {
          provide: PREFEITURA_URL_TOKEN,
          useValue:
            'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx',
        },
      ],
    }).compile();

    service = module.get<NfseQrService>(NfseQrService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildQrValue', () => {
    it('should build QR URL when all required fields are present', () => {
      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: '123456',
          CodigoVerificacao: 'ABC123',
          InscricaoPrestador: '987654321',
        },
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBe(
        'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx?inscricao=987654321&nf=123456&verificacao=ABC123',
      );
    });

    it('should use ChaveRPS inscricao when ChaveNFe inscricao is not available', () => {
      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: '123456',
          CodigoVerificacao: 'ABC123',
          InscricaoPrestador: undefined,
        },
        ChaveRPS: {
          InscricaoPrestador: '555666777',
        },
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBe(
        'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx?inscricao=555666777&nf=123456&verificacao=ABC123',
      );
    });

    it('should fallback to Assinatura field when required NFe fields are missing', () => {
      MockValueFormat.first.mockReturnValue('base64EncodedSignature');
      MockValueFormat.decodeBase64ToUtf8.mockReturnValue(
        'decoded signature content',
      );

      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: 'ABC123',
          InscricaoPrestador: '987654321',
        },
        Assinatura: 'base64EncodedSignature',
      });

      const result = service.buildQrValue(nfseData);

      expect(MockValueFormat.first).toHaveBeenCalledWith(
        'base64EncodedSignature',
      );
      expect(MockValueFormat.decodeBase64ToUtf8).toHaveBeenCalledWith(
        'base64EncodedSignature',
      );
      expect(result).toBe('decoded signature content');
    });

    it('should return raw signature when decoded signature is empty', () => {
      MockValueFormat.first.mockReturnValue('rawSignature');
      MockValueFormat.decodeBase64ToUtf8.mockReturnValue('   ');

      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: 'ABC123',
          InscricaoPrestador: '987654321',
        },
        Assinatura: 'rawSignature',
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBe('rawSignature');
    });

    it('should return null when Assinatura is "Não informado"', () => {
      MockValueFormat.first.mockReturnValue('Não informado');

      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: 'ABC123',
          InscricaoPrestador: '987654321',
        },
        Assinatura: 'Não informado',
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBeNull();
    });

    it('should return null when all required fields are missing and no valid signature', () => {
      MockValueFormat.first.mockReturnValue('Não informado');

      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: undefined,
          CodigoVerificacao: undefined,
          InscricaoPrestador: undefined,
        },
        ChaveRPS: {
          InscricaoPrestador: undefined,
        },
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBeNull();
    });

    it('should handle URL encoding correctly', () => {
      const nfseData = createNfseData({
        ChaveNFe: {
          NumeroNFe: '123/456',
          CodigoVerificacao: 'ABC@123',
          InscricaoPrestador: '987.654.321',
        },
      });

      const result = service.buildQrValue(nfseData);

      expect(result).toBe(
        'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx?inscricao=987.654.321&nf=123%2F456&verificacao=ABC%40123',
      );
    });
  });

  describe('static properties', () => {
    it('should have correct PREF_SP_URL', () => {
      expect(NfseQrService.PREF_SP_URL).toBe(
        'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx',
      );
    });
  });
});
