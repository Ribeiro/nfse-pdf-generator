import { Provider } from '@nestjs/common';

export const PREFEITURA_URL_TOKEN = Symbol('PREFEITURA_URL');
export const PREFEITURA_URL_DEFAULT =
  'https://nfe.prefeitura.sp.gov.br/contribuinte/notaprint.aspx';

export const PrefeituraUrlProvider: Provider = {
  provide: PREFEITURA_URL_TOKEN,
  useFactory: () => process.env.NFSE_PREFEITURA_URL ?? PREFEITURA_URL_DEFAULT,
};
