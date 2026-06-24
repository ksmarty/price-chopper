declare module 'pdfjs-dist/build/pdf.js' {
	interface PDFJS {
		version: string;
		getDocument(params: { data: Uint8Array }): {
			promise: Promise<{
				numPages: number;
				getPage(pageNum: number): Promise<{
					getTextContent(): Promise<{
						items: Array<{
							str: string;
							width: number;
							height: number;
							transform: number[];
							fontName: string;
						}>;
					}>;
					cleanup(): void;
				}>;
				destroy(): void;
			}>;
		};
	}
	const pdfjsLib: PDFJS;
	export = pdfjsLib;
}
