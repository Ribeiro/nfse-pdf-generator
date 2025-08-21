import { Provider } from '@nestjs/common';
import {
  createNfseInfraFromEnv,
  type AssetLoader,
  type IMunicipioResolver,
} from '../layout/asset-loader';

export const ASSET_LOADER_TOKEN = Symbol('ASSET_LOADER');
export const MUNICIPIO_RESOLVER_TOKEN = Symbol('MUNICIPIO_RESOLVER');

const NFSE_INFRA_TOKEN = Symbol('NFSE_INFRA');

type NfseInfra = {
  assets: AssetLoader;
  municipios: IMunicipioResolver;
};

export const NfseInfrastructureProviders: Provider[] = [
  {
    provide: NFSE_INFRA_TOKEN,
    useFactory: async (): Promise<NfseInfra> => {
      return await createNfseInfraFromEnv();
    },
  },
  {
    provide: ASSET_LOADER_TOKEN,
    useFactory: (infra: NfseInfra): AssetLoader => infra.assets,
    inject: [NFSE_INFRA_TOKEN],
  },
  {
    provide: MUNICIPIO_RESOLVER_TOKEN,
    useFactory: (infra: NfseInfra): IMunicipioResolver => infra.municipios,
    inject: [NFSE_INFRA_TOKEN],
  },
];
