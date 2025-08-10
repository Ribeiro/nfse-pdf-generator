import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { NfseDto } from '../dto/nfse.dto';
import { NfseService } from '../services/nfse.service';
import { PdfGenerationMode } from '../../shared/pdf/pdf.service';
import { NfseControllerHelpers as H } from '../helpers/nfse-controller.helpers';

@Controller('nfse')
export class NfseController {
  constructor(private readonly nfseService: NfseService) {}

  @Post('gerar-pdf')
  async gerarPdf(@Body() body: NfseDto, @Res() res: Response) {
    const mode: PdfGenerationMode = H.resolveMode(body);
    const zipName = H.resolveZipName(body);

    const buffer = await H.generateBuffer(
      this.nfseService,
      body,
      mode,
      zipName,
    );

    H.setResponseHeaders(res, mode, zipName);
    return H.sendBuffer(res, buffer);
  }
}
