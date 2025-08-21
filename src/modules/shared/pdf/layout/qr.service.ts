import { Injectable, Inject } from '@nestjs/common';
import { ValueFormat as Fmt } from './value-format';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import {
  PREFEITURA_URL_TOKEN,
  PREFEITURA_URL_DEFAULT,
} from '../providers/prefeitura-url.provider';

@Injectable()
export class NfseQrService {
  static readonly PREF_SP_URL = PREFEITURA_URL_DEFAULT;

  constructor(
    @Inject(PREFEITURA_URL_TOKEN)
    private readonly prefeituraUrl: string = NfseQrService.PREF_SP_URL,
  ) {}

  buildQrValue(n: NfseData): string | null {
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
      return `${this.prefeituraUrl}?${params.toString()}`;
    }

    const raw = Fmt.first(n.Assinatura);
    if (raw === 'Não informado') return null;
    const decoded = Fmt.decodeBase64ToUtf8(raw).trim();
    return decoded.length > 0 ? decoded : raw;
  }
}
