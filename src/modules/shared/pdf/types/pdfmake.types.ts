import type { EventEmitter } from 'events';
import type {
  Content,
  TDocumentDefinitions as PdfDocDef,
} from 'pdfmake/interfaces';

export interface FontDescriptor {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

export interface FontDictionary {
  [fontName: string]: FontDescriptor;
}

export interface PdfPrinterConstructor {
  new (fontDescriptors: FontDictionary): PdfPrinter;
}

export type FooterFn = (
  currentPage: number,
  pageCount: number,
  pageSize: {
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
  },
) => Content;

export type TDocumentDefinitions = Omit<PdfDocDef, 'footer'> & {
  pageSize?: any;
  pageMargins?: number[] | [number, number, number, number];
  content: any[];
  styles?: Record<string, any>;
  defaultStyle?: Record<string, any>;
  images?: Record<string, string>;
  footer?: Content | FooterFn;
};

export interface PdfPrinter {
  createPdfKitDocument(docDefinition: TDocumentDefinitions): PdfKitDocument;
}

export interface PdfKitDocument extends EventEmitter {
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  end(): void;
}
