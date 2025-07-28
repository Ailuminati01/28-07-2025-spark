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