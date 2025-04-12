import mammoth from 'mammoth';

// Dynamically import PDF.js and Worker
let pdfjsLib: any;
let isPDFJSInitialized = false;

if (typeof window !== 'undefined') {
  import('pdfjs-dist').then((pdfjs) => {
    pdfjsLib = pdfjs;
    // Use local Worker file (requires bundler configuration)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    isPDFJSInitialized = true;
  });
}

export async function parsePDF(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be used in browser environment');
    }

    // Wait for PDF.js initialization
    await new Promise((resolve) => {
      const checkInitialization = () => {
        if (isPDFJSInitialized) resolve(true);
        else setTimeout(checkInitialization, 50);
      };
      checkInitialization();
    });

    const pdf = await pdfjsLib.getDocument(buffer).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    
    return text;
  } catch (error) {
    console.error('PDF parsing error: ', error);
    throw new Error('PDF parsing failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error: ', error);
    throw new Error('DOCX parsing failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Generic text file parser
export async function parseTextFile(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(buffer);
}