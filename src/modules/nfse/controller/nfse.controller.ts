import { Controller, Post, Body, Response } from '@nestjs/common';
import { NfseDto } from '../dto/nfse.dto';
import { NfseService } from '../services/nfse.service';
import { Response as Res } from 'express';

@Controller('nfse')
export class NfseController {
  constructor(private readonly nfseService: NfseService) {}

  @Post('gerar-pdf')
  async gerarPdf(@Body() nfseDto: NfseDto, @Response() res: Res) {
    const pdfBuffer = await this.nfseService.processarNfse(nfseDto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=nota_fiscal.pdf',
    });
    res.send(pdfBuffer);
  }
}
