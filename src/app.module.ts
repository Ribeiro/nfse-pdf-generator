import { Module } from '@nestjs/common';
import { NfseController } from './modules/nfse/controller/nfse.controller';
import { NfseService } from './modules/nfse/services/nfse.service';
import { PdfService } from './modules/shared/pdf/pdf.service';

@Module({
  imports: [],
  controllers: [NfseController],
  providers: [NfseService, PdfService],
})
export class AppModule {}
