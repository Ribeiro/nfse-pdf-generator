import { Module } from '@nestjs/common';
import { NfseController } from './modules/nfse/controller/nfse.controller';
import { PdfService } from './modules/nfse/services/pdf.service';

@Module({
  imports: [],
  controllers: [NfseController],
  providers: [PdfService],
})
export class AppModule {}
