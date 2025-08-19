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

export type Alignment = 'left' | 'right' | 'center' | 'justify';
export type Margins = number | [number, number, number, number];

export interface TableCell {
  text?: string;
  image?: string;
  stack?: Content[];
  rowSpan?: number;
  colSpan?: number;
  margin?: Margins;
  alignment?: Alignment;
  style?: string;
  bold?: boolean;
  fontSize?: number;
  color?: string;
  noWrap?: boolean;
}

export interface ContentText {
  text: string;
  style?: string;
  margin?: Margins;
  bold?: boolean;
  italics?: boolean;
  fontSize?: number;
  alignment?: Alignment;
  lineHeight?: number;
  color?: string;
  pageBreak?: 'before' | 'after';
}

export interface ContentImage {
  image: string;
  fit?: [number, number] | number;
  alignment?: Alignment;
  margin?: Margins;
}

export interface ContentTable {
  table: {
    widths?: Array<string | number>;
    body: any[][];
  };
  layout?: unknown;
  margin?: Margins;
}

export interface ContentColumns {
  columns: any[];
  columnGap?: number;
  margin?: Margins;
}

export interface ContentQr {
  qr: string;
  fit?: number;
  alignment?: Alignment;
  margin?: Margins;
}

export type Content =
  | string
  | ContentText
  | ContentImage
  | ContentTable
  | ContentColumns
  | ContentQr
  | { [k: string]: unknown };

export type PageOrientation = 'portrait' | 'landscape';
export type PageSizeName =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'LETTER'
  | 'LEGAL'
  | 'TABLOID';
export type PageSize = PageSizeName | { width: number; height: number };

export type FooterFn = (
  currentPage: number,
  pageCount: number,
  pageSize: { width: number; height: number; orientation: PageOrientation },
) => Content;

export type HeaderFn = (
  currentPage: number,
  pageCount: number,
  pageSize: { width: number; height: number; orientation: PageOrientation },
) => Content;

export interface TDocumentDefinitions {
  pageSize?: PageSize;
  pageMargins?: Margins | [number, number, number, number];
  content: Content[];
  styles?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
  images?: Record<string, string>;
  header?: Content | HeaderFn;
  footer?: Content | FooterFn;
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

type LineWidthFn = (i: number, node: unknown) => number;
type LineColorFn = (i: number, node: unknown) => string;
type PaddingFn = (i: number, node: unknown) => number;

export interface TableLayout {
  hLineWidth?: LineWidthFn;
  vLineWidth?: LineWidthFn;
  hLineColor?: LineColorFn;
  vLineColor?: LineColorFn;
  hLineStyle?: (
    i: number,
    node: unknown,
  ) => { dash?: { length: number; space: number } } | undefined;
  vLineStyle?: (
    i: number,
    node: unknown,
  ) => { dash?: { length: number; space: number } } | undefined;
  paddingLeft?: PaddingFn;
  paddingRight?: PaddingFn;
  paddingTop?: PaddingFn;
  paddingBottom?: PaddingFn;

  fillColor?: (
    rowIndex: number,
    node: unknown,
    columnIndex?: number,
  ) => string | undefined;
  fillOpacity?: (
    rowIndex: number,
    node: unknown,
    columnIndex?: number,
  ) => number | undefined;
}
