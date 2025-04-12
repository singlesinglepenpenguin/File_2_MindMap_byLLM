'use client'

import React, { useState, useEffect } from 'react'
import { generateMindMap } from './services/api'
import { NodeData, ProcessedText, HistoryItem } from './types/types'
import { Button } from "@/components/ui/button"
import MindMap from '@/components/MindMap'
import { toast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import FileUploader from '@/components/FileUploader'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [mindMapData, setMindMapData] = useState<NodeData | null>(null)
  const [isFileSelected, setIsFileSelected] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<ProcessedText[]>([])
  // Add useState declaration at the top
  const [mermaidMarkdown, setMermaidMarkdown] = useState<string>('')
  const [tokenLimit, setTokenLimit] = useState<number>(10000);
  
  // Monitor mindMapData changes
  useEffect(() => {
    console.log('mindMapData updated:', mindMapData);
  }, [mindMapData]);

  // File upload handler
  const handleFileUpload = async (
    files: ProcessedText[],
    progress: { currentChunk: number; totalChunks: number; fileName: string }
  ) => {
    console.log('Processing file upload, files count: ', files.length);
    setUploadedFiles(prevFiles => [...prevFiles, ...files]);
    setIsFileSelected(true);
  };

  // Generate mind map handler
  const handleGenerateMap = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('Button clicked, uploadedFiles: ', uploadedFiles);
    
    if (!uploadedFiles.length) {
      console.log('No valid files');
      return;
    }

    setIsLoading(true);
    let currentHistory: HistoryItem[] = [];

    try {
      console.log('Starting file processing...');
      for (const file of uploadedFiles) {
        console.log(`Processing file: ${file.fileName}`);
        
        for (let i = 0; i < file.chunks.length; i++) {
          const chunk = file.chunks[i];
          console.log(`Processing chunk ${i + 1}/${file.chunks.length}`);
          
          try {
            const { mindMap, mermaidCode } = await generateMindMap(chunk, currentHistory, {
              currentChunk: i + 1,
              totalChunks: file.chunks.length,
              fileName: file.fileName
            });
          
            console.log('Received new mindMap data:', mindMap);
            
            // Use setState callback to ensure latest state
            await new Promise<void>((resolve) => {
              setMindMapData(prevData => {
                console.log('Updating mindMapData, before:', prevData);
                console.log('Updating mindMapData, after:', mindMap);
                return mindMap;
              });
              setMermaidMarkdown(mermaidCode);
              setTimeout(resolve, 100);
            });
            
            console.log('mindMapData updated');
            
            // Update history
            currentHistory = [
              ...currentHistory,
              { role: 'user', content: chunk },
              { role: 'assistant', content: JSON.stringify(mindMap) }
            ];

            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Chunk ${i + 1} processed, mind map updated`);

          } catch (chunkError) {
            console.error('Error processing chunk: ', chunkError);
            throw chunkError;
          }
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Error",
        description: "Error processing files",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">File_2_MindMap_byLLM</h1>
        <p className="text-gray-600">Upload your file to get the mind map</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Upload File</h3>
              <div className="flex items-center gap-2">
                <label 
                  htmlFor="tokenLimit" 
                  className="text-sm text-gray-600"
                >
                  Token Limit:
                </label>
                <input 
                  id="tokenLimit"
                  type="number" 
                  value={tokenLimit}
                  onChange={(e) => setTokenLimit(Number(e.target.value))}
                  className="w-24 px-2 py-1 text-sm border rounded"
                  min="1000"
                  max="50000"
                />
              </div>
            </div>
              <FileUploader 
                onTextExtracted={handleFileUpload}
                disabled={isLoading}
                className="mt-2"
                onFileSelect={(hasFiles) => setIsFileSelected(hasFiles)}
                tokenLimit={tokenLimit}
              />
              <Button
                onClick={handleGenerateMap}
                disabled={!isFileSelected || isLoading}
                className="w-full mt-4"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate Mind Map"
                )}
              </Button>
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Markdown Text</h3>
                  <div className="relative">
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-[300px] font-mono">
                      {mermaidMarkdown}
                    </pre>
                  {mermaidMarkdown && (
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(mermaidMarkdown);
                        toast({
                          title: "Copied",
                          description: "Mermaid markdown has been copied to clipboard"
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      Copy
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden h-[600px]">
          {mindMapData ? (
            <MindMap data={mindMapData} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Mind map will be displayed here after uploading a file
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500 mt-2">
          isFileSelected: {isFileSelected.toString()}<br/>
          uploadedFiles: {uploadedFiles.length}
        </div>
      </div>
      
      <Toaster />
    </main>
  )
}