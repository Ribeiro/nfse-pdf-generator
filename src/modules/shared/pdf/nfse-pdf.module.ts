import { Module } from '@nestjs/common';
import { NfseLayoutBuilder } from './layout/nfse-layout.builder';
import { NfseSections } from './layout/nfse-sections';
import { NfseQrService } from './layout/qr.service';
import { NfseInfrastructureProviders } from './providers/nfse-infrastructure.provider';

@Module({
  providers: [
    ...NfseInfrastructureProviders,
    NfseLayoutBuilder,
    NfseSections,
    NfseQrService,
  ],
  exports: [NfseLayoutBuilder, NfseSections, NfseQrService],
})
export class NfsePdfModule {}
