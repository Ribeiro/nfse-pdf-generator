import type {
  TDocumentDefinitions,
  FontDictionary,
} from '../types/pdfmake.types';
import type { Content } from 'pdfmake/interfaces';
import { nfseStyles } from './nfse-styles';
import type { NfseData } from 'src/modules/nfse/types/nfse.types';
import { NfseSections } from './nfse-sections';
import { DefaultAssetLoader } from './asset-loader';
import { NfseQrService } from './qr.service';
import { makeCancelledOverlayHeader } from './watermark';

export interface BuildOptions {
  header?: { orgName?: string; deptName?: string; docTitle?: string };
}

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

  private readonly sections: NfseSections;
  private readonly qr = new NfseQrService();

  private static readonly qrSize = 64;

  constructor(private readonly opts: BuildOptions = {}) {
    this.sections = new NfseSections(new DefaultAssetLoader());
  }

  public buildNotaContent(n: NfseData): Content[] {
    return [
      this.sections.header(n),
      this.sections.meta(n),
      this.sections.prestador(n),
      this.sections.tomador(n),
      this.sections.discriminacao(n),
      this.sections.valores(n),
      this.sections.avisos(),
    ];
  }

  public buildDocument(
    nfseDataList: NfseData[],
    cancelled = false,
  ): TDocumentDefinitions {
    const content: Content[] = [];
    nfseDataList.forEach((n, i) => {
      content.push(...this.buildNotaContent(n));
      if (i < nfseDataList.length - 1)
        content.push({ text: ' ', pageBreak: 'after' });
    });

    const first = nfseDataList[0];
    const footerBoxHeight = NfseLayoutBuilder.qrSize + 12;
    const bottomMargin = Math.max(footerBoxHeight, 36);

    const doc: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [18, 16, 18, bottomMargin],
      content,
      styles: nfseStyles,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      footer: (currentPage: number): Content => {
        if (currentPage !== 1) return { text: '' };
        const qrValue = first ? this.qr.buildQrValue(first) : null;
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

    return doc;
  }
}
