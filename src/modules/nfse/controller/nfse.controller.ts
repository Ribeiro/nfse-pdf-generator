import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { NfseDto } from '../dto/nfse.dto';
import { NfseService } from '../services/nfse.service';
import { NfseControllerHelpers as H } from '../helpers/nfse-controller.helpers';

@Controller('nfse')
export class NfseController {
  constructor(private readonly nfseService: NfseService) {}

  @Post('gerar-pdf')
  async gerarPdf(@Body() body: NfseDto, @Res() res: Response) {
    const mode = H.resolveMode(body);
    const zipName = H.resolveZipName(body);

    H.setResponseHeaders(res, mode, zipName);
    const stream = await H.generateStream(
      this.nfseService,
      body,
      mode,
      zipName,
    );
    return H.pipe(res, stream);
  }
}
