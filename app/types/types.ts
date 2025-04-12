export interface NodeData {
  id: string;
  label: string;
  children?: NodeData[];
  details?: string | string[];
  filePrefix?: string;
}

export interface ApiResponse {
  session_id: string;
  outputs: {
    inputs: {
      input_value: string;
    };
    outputs: {
      results: {
        message: {
          text: string;
          [key: string]: any;
        };
      };
      artifacts: {
        message: string;
        [key: string]: any;
      };
      outputs: {
        message: {
          message: {
            text: string;
            [key: string]: any;
          };
          type: string;
        };
      };
      logs: {
        message: any[];
      };
      messages: {
        message: string;
        sender: string;
        sender_name: string;
        session_id: string;
        stream_url: null;
        component_id: string;
        files: any[];
        type: string;
      }[];
      timedelta: null;
      duration: null;
      component_display_name: string;
      component_id: string;
      used_frozen_result: boolean;
    }[];
  }[];
}
export interface HistoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProcessedText {
  chunks: string[];
  fileName: string;
} 

export interface ChunkProgress {
  currentFile: string;
  fileProgress: number;
  totalFiles: number;
  currentChunk: number;
  totalChunks: number;
}

