import { Provider } from '@nestjs/common';
import {
  createNfseInfraFromEnv,
  type AssetLoader,
  MunicipioResolver,
  type IMunicipioResolver,
} from '../layout/asset-loader';

export const ASSET_LOADER_TOKEN = Symbol('ASSET_LOADER');
export const MUNICIPIO_RESOLVER_TOKEN = Symbol('MUNICIPIO_RESOLVER');

export const NfseInfrastructureProviders: Provider[] = [
  {
    provide: ASSET_LOADER_TOKEN,
    useFactory: async (): Promise<AssetLoader> => {
      const { assets } = await createNfseInfraFromEnv();
      return assets;
    },
  },
  {
    provide: MUNICIPIO_RESOLVER_TOKEN,
    useFactory: (): IMunicipioResolver => {
      return MunicipioResolver.fromEnv();
    },
  },
];
