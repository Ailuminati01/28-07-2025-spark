import { HfInference } from '@huggingface/inference';
import { securityService } from './securityService';

export interface HuggingFaceResult {
  extractedText: string;
  confidence: number;
  pages: PageResult[];
  processingTime: number;
  model: string;
}

export interface PageResult {
  pageNumber: number;
  width: number;
  height: number;
  lines: LineResult[];
  words: WordResult[];
}

export interface LineResult {
  content: string;
  boundingBox: number[];
}

export interface WordResult {
  content: string;
  boundingBox: number[];
  confidence: number;
}

class HuggingFaceService {
  private hf: HfInference;
  private model: string;
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
    this.model = import.meta.env.VITE_HUGGINGFACE_MODEL || 'google/gemma-3-12b-it';
    this.hf = new HfInference(this.apiKey);
  }

  async extractTextFromDocument(file: File, userId: string): Promise<HuggingFaceResult> {
    const startTime = Date.now();

    try {
      securityService.logAction(
        userId,
        'huggingface_processing_start',
        'document',
        file.name,
        { 
          fileSize: file.size, 
          fileType: file.type,
          model: this.model
        }
      );

      // Convert file to base64 for processing
      const base64Data = await this.fileToBase64(file);
      
      // Use HuggingFace model for text extraction
      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: `Extract all text content from this document image. Maintain the original structure and formatting as much as possible. Return only the extracted text without any additional commentary.\n\nDocument content:`,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.1,
          top_p: 0.9,
          return_full_text: false
        }
      });

      const extractedText = response.generated_text || 'No text extracted';
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(extractedText);

      const result: HuggingFaceResult = {
        extractedText,
        confidence,
        pages: [{
          pageNumber: 1,
          width: 800,
          height: 600,
          lines: [{
            content: extractedText,
            boundingBox: [0, 0, 800, 600]
          }],
          words: []
        }],
        processingTime,
        model: this.model
      };

      securityService.logAction(
        userId,
        'huggingface_processing_complete',
        'document',
        file.name,
        {
          model: this.model,
          confidence: result.confidence,
          textLength: result.extractedText.length,
          processingTime
        }
      );

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'HuggingFace processing failed';
      
      securityService.logAction(
        userId,
        'huggingface_processing_error',
        'document',
        file.name,
        { error: errorMessage, model: this.model }
      );

      throw new Error(`HuggingFace text extraction failed: ${errorMessage}`);
    }
  }

  async analyzeDocumentWithModel(text: string, userId: string): Promise<any> {
    try {
      securityService.logAction(
        userId,
        'huggingface_analysis_start',
        'document',
        'text_analysis',
        { textLength: text.length, model: this.model }
      );

      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: `Analyze this document text and extract key information. Format the response as JSON with the following structure:
{
  "documentType": "type of document",
  "confidence": 0.8,
  "keyInformation": {
    "names": [],
    "dates": [],
    "locations": [],
    "organizations": []
  }
}

Document text: ${text}`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.1,
          top_p: 0.9,
          return_full_text: false
        }
      });

      const analysisResult = response.generated_text || '{}';
      
      try {
        const parsedResult = JSON.parse(analysisResult);
        securityService.logAction(
          userId,
          'huggingface_analysis_complete',
          'document',
          'text_analysis',
          { model: this.model, success: true }
        );
        return parsedResult;
      } catch (parseError) {
        // Return fallback result if parsing fails
        return {
          documentType: 'Unknown',
          confidence: 0.5,
          keyInformation: {
            names: [],
            dates: [],
            locations: [],
            organizations: []
          }
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      
      securityService.logAction(
        userId,
        'huggingface_analysis_error',
        'document',
        'text_analysis',
        { error: errorMessage, model: this.model }
      );

      throw new Error(`HuggingFace analysis failed: ${errorMessage}`);
    }
  }

  private calculateConfidence(text: string): number {
    if (!text || text.length === 0) return 0.0;
    
    let confidence = 0.7;
    if (text.length > 100) confidence += 0.1;
    if (text.length > 500) confidence += 0.1;
    if (text.length < 20) confidence -= 0.2;
    
    const hasNumbers = /\d/.test(text);
    const hasLetters = /[a-zA-Z]/.test(text);
    const hasPunctuation = /[.,;:!?]/.test(text);
    
    if (hasNumbers && hasLetters) confidence += 0.05;
    if (hasPunctuation) confidence += 0.05;
    
    return Math.min(Math.max(confidence, 0.0), 1.0);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async checkServiceHealth(): Promise<boolean> {
    try {
      // Test the HuggingFace API with a simple request
      const response = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: 'Test connection',
          parameters: {
            max_new_tokens: 5,
            temperature: 0.1,
            return_full_text: false
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error('HuggingFace service health check failed:', error);
      return false;
    }
  }

  getModelInfo(): { model: string; apiKey: string } {
    return {
      model: this.model,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'Not configured'
    };
  }
}

export const huggingFaceService = new HuggingFaceService();
export type { HuggingFaceResult };