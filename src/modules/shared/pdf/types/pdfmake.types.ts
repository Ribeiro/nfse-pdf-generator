import type { EventEmitter } from 'events';

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

export interface TDocumentDefinitions {
  pageSize?: any;
  pageMargins?: number[] | [number, number, number, number];
  content: any[];
  styles?: Record<string, any>;
  defaultStyle?: Record<string, any>;
  images?: Record<string, string>;
}

export interface PdfPrinter {
  createPdfKitDocument(docDefinition: TDocumentDefinitions): PdfKitDocument;
}

export interface PdfKitDocument extends EventEmitter {
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  end(): void;
}
