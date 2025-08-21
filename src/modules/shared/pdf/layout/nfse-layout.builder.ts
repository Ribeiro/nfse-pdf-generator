import type {
  TDocumentDefinitions,
  FontDictionary,
  Content,
} from '../types/pdfmake.types';
import { nfseStyles } from './nfse-styles';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { NfseSections } from './nfse-sections';
import { NfseQrService } from './qr.service';
import { makeCancelledOverlayHeader } from './watermark';
import { Injectable } from '@nestjs/common';

export interface BuildOptions {
  header?: { orgName?: string; deptName?: string; docTitle?: string };
}

@Injectable()
export class NfseLayoutBuilder {
  public static readonly fonts: FontDictionary = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
    Times: {
      normal: 'Times-Roman',
      bold: 'Times-Bold',
      italics: 'Times-Italic',
      bolditalics: 'Times-BoldItalic',
    },
    Courier: {
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique',
    },
  };

  private static readonly qrSize = 64;

  constructor(
    private readonly sections: NfseSections,
    private readonly qrService: NfseQrService,
  ) {}

  public async buildNotaContent(n: NfseData): Promise<Content[]> {
    const [header, meta, prestador, tomador, discriminacao, valores, avisos] =
      await Promise.all([
        this.sections.header(n),
        Promise.resolve(this.sections.meta(n)),
        this.sections.prestador(n),
        this.sections.tomador(n),
        Promise.resolve(this.sections.discriminacao(n)),
        Promise.resolve(this.sections.valores(n)),
        Promise.resolve(this.sections.avisos()),
      ]);

    return [header, meta, prestador, tomador, discriminacao, valores, avisos];
  }

  public async buildDocument(
    nfseDataList: NfseData[],
    cancelled = false,
  ): Promise<TDocumentDefinitions> {
    const blocos = await Promise.all(
      nfseDataList.map((n) => this.buildNotaContent(n)),
    );

    const content: Content[] = [];
    for (let i = 0; i < blocos.length; i++) {
      content.push(...blocos[i]);
      if (i < blocos.length - 1)
        content.push({ text: ' ', pageBreak: 'after' });
    }

    const first = nfseDataList[0];
    const footerBoxHeight = NfseLayoutBuilder.qrSize + 12;
    const bottomMargin = Math.max(footerBoxHeight, 36);

    return {
      pageSize: 'A4',
      pageMargins: [18, 16, 18, bottomMargin],
      content,
      styles: nfseStyles,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      footer: (currentPage: number): Content => {
        if (currentPage !== 1) return { text: '' };
        const qrValue = first ? this.qrService.buildQrValue(first) : null;
        if (!qrValue) return { text: '' };
        return {
          margin: [18, 2, 18, 6],
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              qr: qrValue,
              fit: NfseLayoutBuilder.qrSize,
              alignment: 'right',
            },
          ],
          columnGap: 10,
        };
      },
      ...(cancelled ? { header: makeCancelledOverlayHeader() } : {}),
    };
  }
}
