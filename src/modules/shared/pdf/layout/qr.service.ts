import { ValueFormat as Fmt } from './value-format';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';

export class NfseQrService {
  static readonly PREF_SP_URL =
    'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx';

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
      return `${NfseQrService.PREF_SP_URL}?${params.toString()}`;
    }

    const raw = Fmt.first(n.Assinatura);
    if (raw === 'Não informado') return null;
    const decoded = Fmt.decodeBase64ToUtf8(raw).trim();
    return decoded.length > 0 ? decoded : raw;
  }
}
