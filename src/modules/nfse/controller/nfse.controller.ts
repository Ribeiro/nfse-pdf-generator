import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { NfseDto } from '../dto/nfse.dto';
import { NfseControllerHelpers as H } from '../helpers/nfse-controller.helpers';
import { PdfService } from 'src/modules/nfse/services/pdf.service';

@Controller('nfse')
export class NfseController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('gerar-pdf')
  async gerarPdf(@Body() body: NfseDto, @Res() res: Response) {
    const mode = H.resolveMode(body);
    const zipName = H.resolveZipName(body);

    H.setResponseHeaders(res, mode, zipName);
    const stream = await H.generateStream(this.pdfService, body, mode, zipName);
    return H.pipe(res, stream);
  }
}
