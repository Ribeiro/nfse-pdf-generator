import { Module } from '@nestjs/common';
import { NfseModule } from './modules/nfse/nfse.module';

@Module({
  imports: [NfseModule],
})
export class AppModule {}
