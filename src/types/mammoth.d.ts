declare module 'mammoth' {
  export interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: any;
    path?: string;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    convertImage?: any;
    ignoreEmptyParagraphs?: boolean;
  }

  export interface ConvertResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export function convertToHtml(options: ConvertOptions, customOptions?: any): Promise<ConvertResult>;
  export function convertToMarkdown(options: ConvertOptions, customOptions?: any): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<{ value: string; messages: any[] }>;

  export namespace images {
    export function imgElement(
      callback: (image: {
        contentType: string;
        read: (encoding?: string) => Promise<string>;
      }) => Promise<{ src: string } | { [key: string]: any }>
    ): any;
  }

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    convertToMarkdown: typeof convertToMarkdown;
    extractRawText: typeof extractRawText;
    images: typeof images;
  };

  export default mammoth;
}
