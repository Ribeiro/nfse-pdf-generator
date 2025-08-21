import { Module } from '@nestjs/common';
import { NfsePdfModule } from '../shared/pdf/nfse-pdf.module';
import { PdfService } from './services/pdf.service';
import { NfseController } from './controller/nfse.controller';

@Module({
  imports: [NfsePdfModule],
  providers: [PdfService],
  controllers: [NfseController],
  exports: [PdfService],
})
export class NfseModule {}
