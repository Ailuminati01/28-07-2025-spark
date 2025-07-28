import { securityService } from './securityService';

interface DateInformation {
  Date: string | null;
  Format: string | null;
  Confidence: number;
  ExtractedFromText: string | null;
}

interface StampDetectionResult {
  Status: 'Present' | 'Absent';
  Coordinates: [number, number, number, number] | null;
  Type?: string;
  Confidence?: number;
  DateInfo?: DateInformation;
}

interface SignatureDetectionResult {
  Status: 'Present' | 'Absent';
  Coordinates: [number, number, number, number] | null;
  Confidence?: number;
  DateInfo?: DateInformation;
}

interface StampSignatureAnalysisResult {
  Stamp: StampDetectionResult;
  Signature: SignatureDetectionResult;
  StampValidation: 'Y' | 'N';
  MatchedStampType?: string;
  ProcessingTime: number;
  DateAnalysis: {
    StampDate: DateInformation | null;
    SignatureDate: DateInformation | null;
    DocumentDate: DateInformation | null;
    DateConsistency: 'Consistent' | 'Inconsistent' | 'Unknown';
  };
}

// Master list of official stamps
const OFFICIAL_STAMP_MASTER_LIST = [
  {
    id: 'stamp_1',
    name: 'OFFICER COMMANDING 14th BN A.P.S.P. ANANTHAPURAMU',
    keywords: ['OFFICER COMMANDING', '14TH BN', 'A.P.S.P', 'ANANTHAPURAMU'],
    pattern: /OFFICER\s+COMMANDING.*14.*BN.*A\.P\.S\.P.*ANANTHAPURAMU/i
  },
  {
    id: 'stamp_2',
    name: 'STATE OFFICER TO ADGP APSP HEAD OFFICE MANGALAGIRI',
    keywords: ['STATE OFFICER', 'ADGP', 'APSP', 'HEAD OFFICE', 'MANGALAGIRI'],
    pattern: /STATE\s+OFFICER.*ADGP.*APSP.*HEAD\s+OFFICE.*MANGALAGIRI/i
  },
  {
    id: 'stamp_3',
    name: 'Inspector General of Police APSP Bns, Amaravathi',
    keywords: ['INSPECTOR GENERAL', 'POLICE', 'APSP', 'BNS', 'AMARAVATHI'],
    pattern: /INSPECTOR\s+GENERAL.*POLICE.*APSP.*BNS.*AMARAVATHI/i
  },
  {
    id: 'stamp_4',
    name: 'Dy. Inspector General of Police-IV APSP Battalions, Mangalagiri',
    keywords: ['DY', 'INSPECTOR GENERAL', 'POLICE', 'APSP', 'BATTALIONS', 'MANGALAGIRI'],
    pattern: /DY.*INSPECTOR\s+GENERAL.*POLICE.*APSP.*BATTALIONS.*MANGALAGIRI/i
  },
  {
    id: 'stamp_5',
    name: 'Sd/- B. Sreenivasulu, IPS., Addl. Commissioner of Police, Vijayawada City',
    keywords: ['SD', 'SREENIVASULU', 'IPS', 'COMMISSIONER', 'POLICE', 'VIJAYAWADA'],
    pattern: /SD.*SREENIVASULU.*IPS.*COMMISSIONER.*POLICE.*VIJAYAWADA/i
  },
  {
    id: 'stamp_6',
    name: 'Dr. SHANKHABRATA BAGCHI IPS., Addl. Director General of Police, APSP Battalions',
    keywords: ['SHANKHABRATA', 'BAGCHI', 'IPS', 'DIRECTOR GENERAL', 'POLICE', 'APSP', 'BATTALIONS'],
    pattern: /SHANKHABRATA.*BAGCHI.*IPS.*DIRECTOR\s+GENERAL.*POLICE.*APSP.*BATTALIONS/i
  }
];

class StampSignatureService {
  
  // Enhanced date extraction patterns
  private readonly DATE_PATTERNS = [
    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,
    // MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,
    // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g,
    // DD MMM YYYY, DD MMMM YYYY
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi,
    // MMM DD, YYYY
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
    // DD/MM/YY, DD-MM-YY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/g,
    // Ordinal dates: 1st, 2nd, 3rd, 4th, etc.
    /(\d{1,2})(st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi
  ];

  // Date format mapping
  private readonly DATE_FORMAT_MAP = {
    'DD/MM/YYYY': /(\d{1,2})[\/](\d{1,2})[\/](\d{4})/,
    'DD-MM-YYYY': /(\d{1,2})[-](\d{1,2})[-](\d{4})/,
    'DD.MM.YYYY': /(\d{1,2})[.](\d{1,2})[.](\d{4})/,
    'YYYY-MM-DD': /(\d{4})[-](\d{1,2})[-](\d{1,2})/,
    'DD MMM YYYY': /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    'DD MMMM YYYY': /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    'MMM DD, YYYY': /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
  };

  // Extract date information from text
  private extractDateFromText(text: string): DateInformation | null {
    if (!text) return null;

    const cleanText = text.trim();
    let bestMatch: DateInformation | null = null;
    let highestConfidence = 0;

    // Try each date pattern
    for (const pattern of this.DATE_PATTERNS) {
      const matches = Array.from(cleanText.matchAll(pattern));
      
      for (const match of matches) {
        const fullMatch = match[0];
        const dateInfo = this.parseAndValidateDate(fullMatch);
        
        if (dateInfo && dateInfo.Confidence > highestConfidence) {
          highestConfidence = dateInfo.Confidence;
          bestMatch = {
            ...dateInfo,
            ExtractedFromText: fullMatch
          };
        }
      }
    }

    return bestMatch;
  }

  // Parse and validate extracted date
  private parseAndValidateDate(dateString: string): DateInformation | null {
    if (!dateString) return null;

    try {
      // Determine format and parse accordingly
      for (const [format, pattern] of Object.entries(this.DATE_FORMAT_MAP)) {
        const match = dateString.match(pattern);
        if (match) {
          const parsedDate = this.parseDate(dateString, format);
          if (parsedDate) {
            return {
              Date: parsedDate.toISOString().split('T')[0],
              Format: format,
              Confidence: this.calculateDateConfidence(dateString, parsedDate),
              ExtractedFromText: dateString
            };
          }
        }
      }

      // Fallback: try to parse with JavaScript Date
      const fallbackDate = new Date(dateString);
      if (!isNaN(fallbackDate.getTime())) {
        return {
          Date: fallbackDate.toISOString().split('T')[0],
          Format: 'Auto-detected',
          Confidence: 0.6,
          ExtractedFromText: dateString
        };
      }

      return null;
    } catch (error) {
      console.warn('Date parsing failed:', error);
      return null;
    }
  }

  // Parse date based on format
  private parseDate(dateString: string, format: string): Date | null {
    try {
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'January': 0, 'Feb': 1, 'February': 1, 'Mar': 2, 'March': 2,
        'Apr': 3, 'April': 3, 'May': 4, 'Jun': 5, 'June': 5,
        'Jul': 6, 'July': 6, 'Aug': 7, 'August': 7, 'Sep': 8, 'September': 8,
        'Oct': 9, 'October': 9, 'Nov': 10, 'November': 10, 'Dec': 11, 'December': 11
      };

      if (format.includes('MMM') || format.includes('MMMM')) {
        const parts = dateString.split(/[\s,]+/);
        let day, month, year;

        if (format.startsWith('DD')) {
          day = parseInt(parts[0]);
          month = monthMap[parts[1]];
          year = parseInt(parts[2]);
        } else {
          month = monthMap[parts[0]];
          day = parseInt(parts[1]);
          year = parseInt(parts[2]);
        }

        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      } else {
        const parts = dateString.split(/[\/\-\.]/);
        let day, month, year;

        if (format.startsWith('YYYY')) {
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
        } else {
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          year = parseInt(parts[2]);
          
          // Handle 2-digit years
          if (year < 100) {
            year += year < 50 ? 2000 : 1900;
          }
        }

        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Calculate confidence score for date extraction
  private calculateDateConfidence(dateString: string, parsedDate: Date): number {
    let confidence = 0.8;
    
    // Check if date is reasonable (not too far in past or future)
    const now = new Date();
    const yearDiff = Math.abs(now.getFullYear() - parsedDate.getFullYear());
    
    if (yearDiff > 50) confidence -= 0.3;
    if (yearDiff > 100) confidence -= 0.4;
    
    // Check for clear date format
    if (dateString.includes('/') || dateString.includes('-')) confidence += 0.1;
    if (dateString.match(/\d{4}/)) confidence += 0.1; // 4-digit year
    
    // Check for month names
    if (dateString.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
      confidence += 0.1;
    }
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  // Analyze date consistency across stamp, signature, and document
  private analyzeDateConsistency(
    stampDate: DateInformation | null,
    signatureDate: DateInformation | null,
    documentDate: DateInformation | null
  ): 'Consistent' | 'Inconsistent' | 'Unknown' {
    const dates = [stampDate, signatureDate, documentDate].filter(d => d && d.Date);
    
    if (dates.length < 2) return 'Unknown';
    
    const dateValues = dates.map(d => new Date(d!.Date!).getTime());
    const minDate = Math.min(...dateValues);
    const maxDate = Math.max(...dateValues);
    
    // Consider dates consistent if they're within 30 days of each other
    const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    
    return daysDiff <= 30 ? 'Consistent' : 'Inconsistent';
  }

  // Extract text from stamp area (simulated)
  private extractStampText(file: File): Promise<string> {
    return new Promise((resolve) => {
      // Simulate stamp text extraction
      const sampleStampTexts = [
        'OFFICER COMMANDING 14th BN A.P.S.P. ANANTHAPURAMU 15/03/2024',
        'STATE OFFICER TO ADGP APSP HEAD OFFICE MANGALAGIRI 20 March 2024',
        'Inspector General of Police APSP Bns, Amaravathi 22-03-2024',
        'Dy. Inspector General of Police-IV APSP Battalions, Mangalagiri Mar 18, 2024',
        'OFFICIAL STAMP 14th March 2024 APPROVED',
        'VERIFIED ON 16/03/2024 STAMP AUTHORITY'
      ];
      
      setTimeout(() => {
        const randomText = sampleStampTexts[Math.floor(Math.random() * sampleStampTexts.length)];
        resolve(randomText);
      }, 500);
    });
  }

  // Extract text from signature area (simulated)
  private extractSignatureText(file: File): Promise<string> {
    return new Promise((resolve) => {
      // Simulate signature text extraction
      const sampleSignatureTexts = [
        'Signed on 15/03/2024',
        'Date: 20 March 2024',
        'Signature 22-03-2024',
        'Authorized on Mar 18, 2024',
        'Signature Date: 14th March 2024',
        'Signed: 16/03/2024'
      ];
      
      setTimeout(() => {
        const randomText = sampleSignatureTexts[Math.floor(Math.random() * sampleSignatureTexts.length)];
        resolve(randomText);
      }, 500);
    });
  }

  // Extract document date from general text
  private extractDocumentDate(file: File): Promise<DateInformation | null> {
    return new Promise((resolve) => {
      // Simulate document date extraction
      const sampleDocumentTexts = [
        'Document dated 15/03/2024',
        'Issued on 20 March 2024',
        'Date of issue: 22-03-2024',
        'Document Date: Mar 18, 2024',
        'Created on 14th March 2024',
        'Date: 16/03/2024'
      ];
      
      setTimeout(() => {
        const randomText = sampleDocumentTexts[Math.floor(Math.random() * sampleDocumentTexts.length)];
        const dateInfo = this.extractDateFromText(randomText);
        resolve(dateInfo);
      }, 500);
    });
  }

  async analyzeStampsAndSignatures(
    file: File,
    userId: string
  ): Promise<StampSignatureAnalysisResult> {
    const startTime = Date.now();

    try {
      // Log analysis start
      securityService.logAction(
        userId,
        'stamp_signature_analysis_start',
        'document',
        file.name,
        { fileSize: file.size, fileType: file.type }
      );

      // For demo purposes, we'll simulate the analysis
      // In a real implementation, this would call Azure AI Document Intelligence API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate results - always return Present and Y for stamp validation
      const result = {
        Stamp: {
          Status: 'Present' as const,
          Coordinates: [100, 100, 200, 100] as [number, number, number, number],
          Type: 'official_stamp',
          Confidence: 0.85
        },
        Signature: {
          Status: 'Present' as const,
          Coordinates: [300, 400, 150, 50] as [number, number, number, number],
          Confidence: 0.78
        },
        StampValidation: 'Y' as const,
        MatchedStampType: OFFICIAL_STAMP_MASTER_LIST[Math.floor(Math.random() * OFFICIAL_STAMP_MASTER_LIST.length)].name,
        ProcessingTime: 0
      };
      
      // Log successful analysis
      securityService.logAction(
        userId,
        'stamp_signature_analysis_complete',
        'document',
        file.name,
        {
          stampStatus: result.Stamp.Status,
          signatureStatus: result.Signature.Status,
          stampValidation: result.StampValidation,
          processingTime: Date.now() - startTime
        }
      );

      return {
        ...result,
        ProcessingTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      
      // Log analysis error
      securityService.logAction(
        userId,
        'stamp_signature_analysis_error',
        'document',
        file.name,
        { error: errorMessage }
      );

      console.error('Stamp/Signature analysis failed:', errorMessage);

      // Return fallback result
      return {
        Stamp: { Status: 'Absent', Coordinates: null },
        Signature: { Status: 'Absent', Coordinates: null },
        StampValidation: 'N',
        ProcessingTime: Date.now() - startTime
      };
    }
  }

  // Get the master list of official stamps
  getMasterStampList() {
    return OFFICIAL_STAMP_MASTER_LIST.map(stamp => ({
      id: stamp.id,
      name: stamp.name
    }));
  }

  // Public method to check service health
  async checkServiceHealth(): Promise<boolean> {
    try {
      // In a real implementation, this would check the Azure service
      // For demo purposes, we'll simulate a successful connection
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error('Service health check failed:', error);
      return false;
    }
  }
}

export const stampSignatureService = new StampSignatureService();
export type { StampSignatureAnalysisResult };