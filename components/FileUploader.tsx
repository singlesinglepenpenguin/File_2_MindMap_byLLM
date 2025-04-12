"use client"; // Next.js user client component
import { useState } from "react";
import { parsePDF, parseDocx } from "@/lib/fileParser";
import { toast } from '@/components/ui/use-toast'
import { ProcessedText, ChunkProgress } from '@/app/types/types';

interface FileUploaderProps {
    onTextExtracted: (
      chunks: ProcessedText[],
      progress: { currentChunk: number; totalChunks: number; fileName: string }
    ) => Promise<void>;
    disabled?: boolean;
    className?: string;
    onFileSelect?: (hasFiles: boolean) => void;
    tokenLimit: number;
  }

export default function FileUploader({ 
    onTextExtracted, 
    disabled = false, 
    className = "",
    onFileSelect,
    tokenLimit 
  }: Readonly<FileUploaderProps>) {
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessed, setIsProcessed] = useState(false);
    const [progress, setProgress] = useState<ChunkProgress>({
        currentFile: '',
        fileProgress: 0,
        totalFiles: 0,
        currentChunk: 0,
        totalChunks: 0
    });

    // Text chunking function
    const splitText = (text: string): string[] => {
        const chunks: string[] = [];
        let currentChunk = '';
        
        // Split by paragraphs
        const paragraphs = text.split(/\n\s*\n/);
        
        for (const paragraph of paragraphs) {
            const sentences = paragraph.split(/(?<=[.!?。！？])\s+/);
            
            for (const sentence of sentences) {
                if ((currentChunk + sentence).length < tokenLimit) {
                    currentChunk += sentence + ' ';
                } else {
                    if (currentChunk) chunks.push(currentChunk.trim());
                    currentChunk = sentence + ' ';
                }
            }
            if (currentChunk.length > 0) currentChunk += '\n\n';
        }
        
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        return chunks;
    };

    // Process single file
    const processFile = async (file: File): Promise<ProcessedText> => {
        const buffer = await file.arrayBuffer();
        let text = "";

        if (file.name.endsWith(".pdf")) {
            text = await parsePDF(buffer);
        } else if (file.name.endsWith(".docx")) {
            text = await parseDocx(buffer);
        } else {
            text = await file.text();
        }

        const chunks = text.length > tokenLimit ? splitText(text) : [text];
        return { chunks, fileName: file.name };
    };

    // Handle file change event
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) {
            if (onFileSelect) onFileSelect(false);
            return;
        }
    
        setIsLoading(true);
        if (onFileSelect) onFileSelect(true);
    
        try {
            const processedFiles: ProcessedText[] = [];
            console.log('Starting to process files, total:', files.length); 
    
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Processing file ${i + 1}:`, file.name); 
                const processed = await processFile(file);
                processedFiles.push(processed);
                
                setProgress(prev => ({
                    ...prev,
                    currentFile: file.name,
                    fileProgress: i + 1,
                    totalFiles: files.length,
                    totalChunks: processedFiles.reduce((sum, f) => sum + f.chunks.length, 0)
                }));
    
                // Call onTextExtracted for each processed file
                await onTextExtracted(
                    [processed], 
                    {
                        currentChunk: 1,
                        totalChunks: processed.chunks.length,
                        fileName: file.name
                    }
                );
            }
    
            setIsProcessed(true);
        } catch (error) {
            console.error('File processing failed:', error);
            if (onFileSelect) onFileSelect(false);
            toast({
                variant: "destructive",
                title: "Error",
                description: "File processing failed, please check file format"
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className={`mb-4 ${className}`}>
            <label className="block">
            <span className="sr-only">Choose files</span>
            <input 
                type="file" 
                accept=".pdf,.docx,.txt" 
                onChange={handleFileChange}
                disabled={disabled}
                multiple
                className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 hidden"  // Added 'hidden' here
            />
            <div className="block w-full text-sm text-gray-500
                mr-4 py-2 px-4
                rounded-md border-0
                text-sm font-semibold
                bg-blue-50 text-blue-700
                hover:bg-blue-100 cursor-pointer">
                Choose Files
            </div>
        </label>
            {(isLoading || isProcessed) && (
                <div className="mt-2 space-y-2">
                    <div className="h-2 bg-blue-100 rounded-full">
                        <div 
                            className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${(progress.fileProgress / progress.totalFiles) * 100}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-600">
                        {isLoading ? "Processing" : "Completed"}:{progress.currentFile} ({progress.fileProgress}/{progress.totalFiles})
                    </p>
                    <p className="text-sm text-gray-600">
                        Total chunks: {progress.totalChunks}
                    </p>
                </div>
            )}
        </div>
    );
}