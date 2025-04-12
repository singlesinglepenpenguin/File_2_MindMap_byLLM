'use server'
import { NodeData, HistoryItem} from '../types/types'
import { SYSTEM_PROMPTS, SYSTEM_PROMPTS_3 } from './systemPrompts'
const SYSTEM_PROMPTS_USE = SYSTEM_PROMPTS_3;

function getPreviousNodeData(history: HistoryItem[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      return history[i].content;
    }
  }
  return null;
}

// Add new function to convert JSON to Markdown format
async function convertToMarkdown(mindMapData: NodeData): Promise<string> {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-plus-latest',
        messages: [
          {
            role: 'system',
            content: `You are a mind map format conversion expert, tasked with transforming JSON-structured mind map data into markdown format.
              Conversion rules:
              1. Place the root node at the far left
              2. Use heading markers (#) for each non-leaf node level, and list markers (-) for leaf nodes

              Example output format:
              # Topic
              ## [Category1]
              ### Subitem1
              - Detail1
              - Detail2
              ### Subitem2
              ## [Category2]
              - Subitem3
              - Subitem4
          Only output the converted markdown content without any additional explanations.`
          },
          {
            role: 'user',
            content: JSON.stringify(mindMapData, null, 2)
          }
        ],
        temperature: 0.1,
        max_tokens: 8192,
        top_p: 0.1,
        frequency_penalty: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Response Error]:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Conversion failed: ${response.status} ${response.statusText}`);
    }

    try {
      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('[API Return Data Abnormal]:', data);
        throw new Error('API return data format error');
      }

      return data.choices[0].message.content;
    } catch (parseError) {
      console.error('[JSON Parse Error]:', parseError);
      throw new Error('API return data parse failed');
    }

  } catch (error) {
    console.error('[Markdown Conversion Error]:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      if (error.name === 'TypeError') {
        throw new Error('Network request failed');
      }
      throw new Error(`Markdown format conversion failed: ${error.message}`);
    }
    throw new Error('Unknown error');
  }
}

// Add helper function to generate unique file prefix
function generateFilePrefix(fileName: string): string {
  // first 3 characters
  const shortName = fileName.slice(0, 3).replace(/[^a-zA-Z0-9]/g, '_');
  
  // 3-digit random number (0-999)
  const random = Math.floor(Math.random() * 1000)
    .toString(36)  
    .padStart(2, '0');
  return `${shortName}${random}`;
}


// get messages input
function prepareMessages(input: string, history?: HistoryItem[]): any[] {
  const lastMindMapJson = history?.length ? getPreviousNodeData(history) || '' : '';
  
  const messages = [
    { 
      role: 'system', 
      content: history?.length ? SYSTEM_PROMPTS_USE.CONTINUE_CHUNK : SYSTEM_PROMPTS_USE.FIRST_CHUNK
    }
  ];
  
  if (lastMindMapJson) {
    messages.push({
      role: 'assistant',
      content: lastMindMapJson
    });
  }
  
  messages.push({ role: 'user', content: input });
  return messages;
}

// handle stream response
async function handleStreamResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let mindMapData = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        if (line.includes('[DONE]')) {
          console.log('Stream response completed');
          continue;
        }
        
        try {
          const data = JSON.parse(line.slice(6));
          if (data.choices?.[0]?.delta?.content) {
            mindMapData += data.choices[0].delta.content;
          }
        } catch (e) {
          console.warn('Failed to parse stream data chunk:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return mindMapData;
}

// get json response
function cleanJsonData(str: string): string {
  let cleaned = str.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '');
  
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}') + 1;
  if (start === -1 || end === 0) {
    throw new Error('No valid JSON object found');
  }
  
  cleaned = cleaned.substring(start, end)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}')
    .replace(/\]\s*\[/g, '],[')
    .replace(/}\s*{/g, '},{')
    .replace(/\\"/g, '"')
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
    .replace(/:\s*'([^']*?)'/g, ':"$1"');

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    throw new Error('Data still invalid JSON after cleaning');
  }
}

// get unique id
const idUtils = {
  generateDeterministicId(prefix: string, content: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 8);
    return `${prefix}_${hash}`;
  },

  updateNodeIds(root: NodeData, filePrefix: string): void {
    const queue = [{ node: root, parentId: '' }];
    const idMap = new Map<string, string>();
    let idCounter = 1;

    while (queue.length > 0) {
      const { node, parentId } = queue.shift()!;
      const contentHash = node.label + parentId;
      const newId = this.generateDeterministicId(filePrefix, contentHash);
      
      if (idMap.has(newId)) {
        const fallbackId = `${newId}_${idCounter++}`;
        idMap.set(fallbackId, fallbackId);
        node.id = fallbackId;
      } else {
        idMap.set(newId, newId);
        node.id = newId;
      }

      if (node.children) {
        queue.push(...node.children.map(child => ({ node: child, parentId: node.id })));
      }
    }
  },

  validateIds(root: NodeData): boolean {
    const idSet = new Set<string>();
    const stack = [root];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (idSet.has(node.id)) return false;
      idSet.add(node.id);
      if (node.children) stack.push(...node.children);
    }
    
    return true;
  }
};

// use aliyun api to get mindmap
export async function generateMindMap(
  input: string, 
  history?: HistoryItem[],
  progress?: { currentChunk: number; totalChunks: number; fileName: string }
): Promise<{ mindMap: NodeData; mermaidCode: string }> {
  try {
    console.log('Starting generateMindMap, chunk progress:', progress);
    const messages = prepareMessages(input, history);
    
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-plus-latest',
        messages,
        temperature: 0.1,
        max_tokens: 8192,
        top_p: 0.1,
        frequency_penalty: 0,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Unable to get response stream');

    const mindMapData = await handleStreamResponse(reader);
    if (!mindMapData) throw new Error('No mind map data received');

    const cleanedJson = cleanJsonData(mindMapData);
    const parsedData: NodeData = JSON.parse(cleanedJson);

    const basePrefix = progress?.fileName 
      ? generateFilePrefix(progress.fileName)
      : `doc_${Date.now().toString(36)}`;

    idUtils.updateNodeIds(parsedData, basePrefix);
    if (!idUtils.validateIds(parsedData)) {
      throw new Error('Duplicate IDs found in data');
    }

    console.log('Starting Mermaid conversion');
    const mermaidCode = await convertToMarkdown(parsedData);

    return { mindMap: parsedData, mermaidCode };

  } catch (error) {
    console.error('Generation Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}