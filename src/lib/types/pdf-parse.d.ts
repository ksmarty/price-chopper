declare module 'pdf-parse' {
	interface PDFData {
		numpages: number;
		numrender: number;
		info: {
			Title?: string;
			Author?: string;
			Subject?: string;
			Keywords?: string;
			Creator?: string;
			Producer?: string;
			CreationDate?: string;
			ModDate?: string;
		};
		metadata: Record<string, unknown>;
		text: string;
		version: string;
	}

	function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>;

	export default pdfParse;
}
