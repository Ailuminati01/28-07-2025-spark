import React, { useState, useRef } from 'react';
import { Upload, QrCode, Camera, FileImage, Loader2, AlertCircle, CheckCircle, Cpu, Database, Image as ImageIcon, Box, Zap, Eye, Edit3, Save, X, Info, TestTube, FolderSync as Sync, FileText, Stamp, PenTool, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../contexts/DocumentContext';
import { huggingFaceService, HuggingFaceResult } from '../../services/huggingFaceService';
import { openAIService, OpenAIAnalysisResult } from '../../services/openAIService';
import { ollamaService, OllamaTextExtractionResult } from '../../services/ollamaService';
import { temporaryStorageService, TemporaryDocument } from '../../services/temporaryStorageService';
import { databaseService, StoredDocument } from '../../services/databaseService';
import { supabaseService } from '../../services/supabaseService';
import { stampSignatureService, StampSignatureAnalysisResult } from '../../services/stampSignatureService';
import { StampSignatureAnalyzer } from './StampSignatureAnalyzer';

export function UploadInterface() {
  const { user } = useAuth();
  const { documentTypes, addDocument } = useDocuments();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [huggingFaceServiceHealth, setHuggingFaceServiceHealth] = useState<boolean | null>(null);
  const [openAIServiceHealth, setOpenAIServiceHealth] = useState<boolean | null>(null);
  const [ollamaServiceHealth, setOllamaServiceHealth] = useState<boolean | null>(null);
  const [supabaseHealth, setSupabaseHealth] = useState<boolean | null>(null);
  const [temporaryDocuments, setTemporaryDocuments] = useState<TemporaryDocument[]>([]);
  const [selectedTempDoc, setSelectedTempDoc] = useState<TemporaryDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [showFieldMappingDetails, setShowFieldMappingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showStampAnalyzer, setShowStampAnalyzer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    checkServiceHealth();
    loadTemporaryDocuments();
    
    // Cleanup function to revoke object URLs on unmount
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const checkServiceHealth = async () => {
    try {
      const huggingFaceHealth = await huggingFaceService.checkServiceHealth();
      const openAIHealth = await openAIService.checkServiceHealth();
      const ollamaHealth = await ollamaService.checkServiceHealth();
      const supabaseHealthCheck = await supabaseService.checkConnection();
      const stampServiceHealth = await stampSignatureService.checkServiceHealth();
      
      setHuggingFaceServiceHealth(huggingFaceHealth);
      setOpenAIServiceHealth(openAIHealth);
      setOllamaServiceHealth(ollamaHealth);
      setSupabaseHealth(supabaseHealthCheck);
      
      console.log('Service Health Check Results:', {
        huggingFace: huggingFaceHealth,
        openAI: openAIHealth,
        ollama: ollamaHealth,
        supabase: supabaseHealthCheck,
        stampService: stampServiceHealth
      });
    } catch (error) {
      console.error('Service health check failed:', error);
      setHuggingFaceServiceHealth(false);
      setOpenAIServiceHealth(false);
      setOllamaServiceHealth(false);
      setSupabaseHealth(false);
    }
  };

  const testSupabaseConnection = async () => {
    if (!user) return;
    
    setIsTesting(true);
    try {
      console.log('Testing Supabase connection and insert...');
      
      // Test connection
      const connectionOk = await supabaseService.checkConnection();
      console.log('Connection test result:', connectionOk);
      
      if (!connectionOk) {
        alert('Supabase connection failed. Please check your environment variables and database setup.');
        return;
      }
      
      // Test insert
      const insertOk = await supabaseService.testInsert();
      console.log('Insert test result:', insertOk);
      
      if (insertOk) {
        alert('Supabase connection and insert test successful!');
        setSupabaseHealth(true);
      } else {
        alert('Supabase insert test failed. Check console for details.');
        setSupabaseHealth(false);
      }
      
    } catch (error) {
      console.error('Supabase test failed:', error);
      alert(`Supabase test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSupabaseHealth(false);
    } finally {
      setIsTesting(false);
    }
  };

  const syncToSupabase = async () => {
    if (!user) return;
    
    setIsSyncing(true);
    try {
      console.log('Starting manual sync to Supabase...');
      
      const syncResult = await databaseService.syncToSupabase();
      
      if (syncResult.success) {
        alert(`Sync successful! ${syncResult.message}`);
        setSupabaseHealth(true);
      } else {
        alert(`Sync failed: ${syncResult.message}`);
      }
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadTemporaryDocuments = () => {
    try {
      if (user) {
        const tempDocs = temporaryStorageService.getUserTemporaryDocuments(user.id);
        setTemporaryDocuments(tempDocs);
      }
    } catch (error) {
      console.error('Failed to load temporary documents:', error);
    }
  };

  const handleSelectAnother = () => {
    // Clear current preview and file
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Open file dialog
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous preview URL if it exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setSelectedFile(file);
      
      // Create preview URL based on file type
      if (file.type === 'application/pdf') {
        // For PDFs, we'll use the file URL directly
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        // For images, create object URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
      
      processDocument(file);
    }
  };

  const processDocument = async (file: File) => {
    if (!user) return;
    
    setIsProcessing(true);
    setProcessingStage('Initializing Ollama processing...');
    
    try {
      // Step 1: Ollama text extraction using moondream
      setProcessingStage('Extracting text with Ollama moondream...');
      const ollamaResult: OllamaTextExtractionResult = await ollamaService.extractTextFromDocument(file, user.id);

      // Step 2: OpenAI analysis with template matching
      setProcessingStage('Analyzing document and mapping fields with OpenAI...');
      const openAIResult: OpenAIAnalysisResult = await openAIService.analyzeDocument(
        ollamaResult.extractedText,
        documentTypes,
        user.id
      );

      // Step 3: Stamp and signature detection
      setProcessingStage('Detecting stamps and signatures...');
      const stampSignatureResult = await stampSignatureService.analyzeStampsAndSignatures(file, user.id);

      // Step 4: Store in temporary cache
      setProcessingStage('Storing for review...');
      
      // Convert Ollama result to Azure format for compatibility
      const compatibleResult = {
        extractedText: ollamaResult.extractedText,
        confidence: ollamaResult.confidence,
        pages: ollamaResult.pages.map(page => ({
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          lines: [{ content: page.extractedText, boundingBox: [] }],
          words: []
        })),
        tables: [],
        keyValuePairs: [],
        processingTime: ollamaResult.processingTime
      };

      const tempDocId = temporaryStorageService.storeTemporaryDocument(
        file,
        ollamaResult.extractedText,
        compatibleResult,
        openAIResult,
        user.id,
        stampSignatureResult
      );

      setProcessingStage('Processing complete!');
      
      // Refresh temporary documents list
      loadTemporaryDocuments();
      
      // Don't reset form immediately - keep preview visible
      // User can select another file or the preview will be cleared when they do
      // setSelectedFile(null);
      // setPreviewUrl('');
      // if (fileInputRef.current) {
      //   fileInputRef.current.value = '';
      // }
      
    } catch (error) {
      console.error('Document processing failed:', error);
      setProcessingStage('');
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingStage(''), 3000);
    }
  };

  const handleReviewDocument = (tempDoc: TemporaryDocument) => {
    setSelectedTempDoc(tempDoc);
    setEditedFields({ ...tempDoc.extractedFields });
    setIsEditing(false);
    setShowFieldMappingDetails(false);
  };

  const handleEditFields = () => {
    setIsEditing(true);
  };

  const handleSaveEdits = () => {
    if (!selectedTempDoc) return;
    
    try {
      temporaryStorageService.updateTemporaryDocument(selectedTempDoc.id, {
        extractedFields: editedFields
      });
      
      setSelectedTempDoc({
        ...selectedTempDoc,
        extractedFields: editedFields
      });
      
      setIsEditing(false);
      loadTemporaryDocuments();
    } catch (error) {
      console.error('Failed to save edits:', error);
      alert('Failed to save edits. Please try again.');
    }
  };

  const handleCancelEdits = () => {
    if (selectedTempDoc) {
      setEditedFields({ ...selectedTempDoc.extractedFields });
    }
    setIsEditing(false);
  };

  const handleApproveDocument = async () => {
    if (!selectedTempDoc || !user || isSaving) return;

    setIsSaving(true);
    
    try {
      console.log('Starting document approval process...');
      
      // Approve in temporary storage
      temporaryStorageService.approveDocument(selectedTempDoc.id, user.id);

      // Convert file to base64
      console.log('Converting file to base64...');
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(selectedTempDoc.originalFile);
      });

      console.log('Creating stored document object...');
      
      // Create validation metadata if stamp/signature results exist
      let validationMetadata = undefined;
      if (selectedTempDoc.stampSignatureResult) {
        const now = new Date().toISOString();
        validationMetadata = {
          stampValidation: {
            detected: [{
              id: `stamp_${Date.now()}`,
              type: 'official_stamp',
              boundingBox: {
                x: selectedTempDoc.stampSignatureResult.Stamp.Coordinates?.[0] || 0,
                y: selectedTempDoc.stampSignatureResult.Stamp.Coordinates?.[1] || 0,
                width: selectedTempDoc.stampSignatureResult.Stamp.Coordinates?.[2] || 0,
                height: selectedTempDoc.stampSignatureResult.Stamp.Coordinates?.[3] || 0
              },
              confidence: selectedTempDoc.stampSignatureResult.Stamp.Confidence || 0.8,
              imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              location: "Bottom right of document",
              matchesMasterList: selectedTempDoc.stampSignatureResult.StampValidation === 'Y',
              matchedStampType: selectedTempDoc.stampSignatureResult.MatchedStampType
            }],
            status: selectedTempDoc.stampSignatureResult.Stamp.Status,
            count: selectedTempDoc.stampSignatureResult.Stamp.Status === 'Present' ? 1 : 0,
            validationTimestamp: now,
            matchesMasterList: selectedTempDoc.stampSignatureResult.StampValidation === 'Y'
          },
          signatureValidation: {
            detected: [{
              id: `signature_${Date.now()}`,
              type: 'handwritten_signature',
              boundingBox: {
                x: selectedTempDoc.stampSignatureResult.Signature.Coordinates?.[0] || 0,
                y: selectedTempDoc.stampSignatureResult.Signature.Coordinates?.[1] || 0,
                width: selectedTempDoc.stampSignatureResult.Signature.Coordinates?.[2] || 0,
                height: selectedTempDoc.stampSignatureResult.Signature.Coordinates?.[3] || 0
              },
              confidence: selectedTempDoc.stampSignatureResult.Signature.Confidence || 0.7,
              imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              location: "Bottom of document"
            }],
            status: selectedTempDoc.stampSignatureResult.Signature.Status,
            count: selectedTempDoc.stampSignatureResult.Signature.Status === 'Present' ? 1 : 0,
            validationTimestamp: now
          },
          overallValidation: {
            isValid: selectedTempDoc.stampSignatureResult.Stamp.Status === 'Present' && 
                    selectedTempDoc.stampSignatureResult.Signature.Status === 'Present' && 
                    selectedTempDoc.stampSignatureResult.StampValidation === 'Y',
            completeness: selectedTempDoc.stampSignatureResult.Stamp.Status === 'Present' && 
                         selectedTempDoc.stampSignatureResult.Signature.Status === 'Present' ? 100 : 
                         selectedTempDoc.stampSignatureResult.Stamp.Status === 'Present' || 
                         selectedTempDoc.stampSignatureResult.Signature.Status === 'Present' ? 50 : 0,
            missingElements: [
              ...(selectedTempDoc.stampSignatureResult.Stamp.Status === 'Absent' ? ['Official Stamp'] : []),
              ...(selectedTempDoc.stampSignatureResult.Signature.Status === 'Absent' ? ['Signature'] : []),
              ...(selectedTempDoc.stampSignatureResult.StampValidation === 'N' ? ['Valid Stamp'] : [])
            ],
            validatedAt: now,
            validatedBy: user.fullName
          }
        };
      }
      
      // Create stored document
      const storedDocument: StoredDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: selectedTempDoc.suggestedTemplate || documentTypes[0],
        templateVersion: 'v1.0',
        tags: [
          selectedTempDoc.suggestedTemplate?.id || 'unknown',
          'ollama-processed',
          'openai-analyzed',
          'clerk-approved',
          'template-mapped',
          ...(selectedTempDoc.stampSignatureResult?.Stamp.Status === 'Present' ? ['stamp-detected'] : []),
          ...(selectedTempDoc.stampSignatureResult?.Signature.Status === 'Present' ? ['signature-detected'] : []),
          ...(selectedTempDoc.stampSignatureResult?.StampValidation === 'Y' ? ['stamp-validated'] : [])
        ],
        fields: isEditing ? editedFields : selectedTempDoc.extractedFields,
        ocrRawText: selectedTempDoc.extractedText,
        imageUrl: previewUrl,
        createdBy: user.id,
        location: user.station,
        status: 'finalized' as const,
        confidence: selectedTempDoc.confidence,
        timestamp: new Date().toISOString(),
        documentData: fileBase64,
        extractedImages: [],
        processingMetadata: {
          layoutAnalysis: [],
          tableData: [],
          documentClassification: {
            documentType: selectedTempDoc.openAIAnalysis.documentType,
            confidence: selectedTempDoc.confidence,
            language: 'en',
            orientation: 'portrait'
          },
          qualityMetrics: {
            overallQuality: selectedTempDoc.confidence,
            textClarity: selectedTempDoc.azureAIResult?.confidence || selectedTempDoc.confidence,
            imageQuality: 0.8,
            layoutComplexity: 0.5,
            ocrConfidence: selectedTempDoc.azureAIResult?.confidence || selectedTempDoc.confidence
          }
        },
        metadata: {
          processingMethod: 'ollama-openai-template-mapped',
          layout: [],
          tables: selectedTempDoc.azureAIResult?.tables || [],
          documentMetadata: {
            templateMatched: selectedTempDoc.suggestedTemplate?.name,
            templateConfidence: selectedTempDoc.confidence,
            fieldConfidences: {},
            azureProcessed: false,
            ollamaProcessed: true,
            openAIAnalyzed: true,
            templateMapped: true,
            fieldMappingDetails: selectedTempDoc.openAIAnalysis.fieldMappingDetails,
            validationMetadata: validationMetadata
          },
          boundingBoxes: []
        }
      };

      console.log('Saving document to database...', storedDocument.id);
      
      // Save to database (which will sync to both IndexedDB and Supabase)
      const documentId = await databaseService.saveDocument(storedDocument);
      console.log('Document saved successfully with ID:', documentId);
      
      // Add to context for immediate UI update
      addDocument({
        type: storedDocument.type,
        templateVersion: storedDocument.templateVersion,
        tags: storedDocument.tags,
        fields: storedDocument.fields,
        ocrRawText: storedDocument.ocrRawText,
        imageUrl: storedDocument.imageUrl,
        createdBy: storedDocument.createdBy,
        location: storedDocument.location,
        status: storedDocument.status,
        confidence: storedDocument.confidence,
        metadata: storedDocument.metadata
      });

      // Delete from temporary storage
      temporaryStorageService.deleteTemporaryDocument(selectedTempDoc.id, user.id);

      // Show success message
      alert(`Document approved and saved successfully! Document ID: ${documentId}`);
      
      // Reset state
      setSelectedTempDoc(null);
      setIsEditing(false);
      setShowFieldMappingDetails(false);
      loadTemporaryDocuments();
      
    } catch (error) {
      console.error('Failed to approve and save document:', error);
      
      // Show specific error message
      let errorMessage = 'Failed to save document to database.';
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }
      
      alert(errorMessage + ' Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectDocument = () => {
    if (!selectedTempDoc || !user) return;
    
    try {
      const reason = prompt('Please provide a reason for rejection:');
      if (reason) {
        temporaryStorageService.rejectDocument(selectedTempDoc.id, user.id, reason);
        setSelectedTempDoc(null);
        setIsEditing(false);
        setShowFieldMappingDetails(false);
        loadTemporaryDocuments();
      }
    } catch (error) {
      console.error('Failed to reject document:', error);
      alert('Failed to reject document. Please try again.');
    }
  };

  const getServiceStatusColor = (status: boolean | null) => {
    if (status === null) return 'bg-gray-50';
    return status ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200';
  };

  const getServiceStatusIcon = (status: boolean | null) => {
    if (status === null) return 'text-gray-500';
    return status ? 'text-green-600' : 'text-red-600';
  };

  const getServiceStatusText = (status: boolean | null, serviceName: string) => {
    if (status === null) return `${serviceName}: Checking...`;
    return `${serviceName}: ${status ? 'Connected' : 'Unavailable'}`;
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '📝';
      case 'number': return '🔢';
      case 'date': return '📅';
      case 'select': return '📋';
      case 'textarea': return '📄';
      default: return '📝';
    }
  };

  const getFieldSourceColor = (source: string) => {
    switch (source) {
      case 'direct_match': return 'bg-green-100 text-green-800';
      case 'pattern_match': return 'bg-blue-100 text-blue-800';
      case 'context_match': return 'bg-yellow-100 text-yellow-800';
      case 'ai_inference': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderDocumentPreview = () => {
    if (!selectedFile || !previewUrl) return null;

    const isPDF = selectedFile.type === 'application/pdf';

    return (
      <div className="border rounded-lg overflow-hidden relative bg-gray-50">
        <div className="relative w-full h-96">
          {isPDF ? (
            <div className="w-full h-full flex flex-col">
              {/* PDF Header */}
              <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                </div>
                <div className="text-xs text-gray-300">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              
              {/* PDF Viewer */}
              <div className="flex-1 bg-white">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                  style={{ minHeight: '350px' }}
                />
              </div>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Document preview"
              className="w-full h-full object-contain bg-gray-50"
            />
          )}
        </div>
      </div>
    );
  };

  if (showStampAnalyzer) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Stamp & Signature Analysis</h2>
            <button
              onClick={() => setShowStampAnalyzer(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Upload
            </button>
          </div>
        </div>
        
        <StampSignatureAnalyzer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`rounded-lg p-4 ${getServiceStatusColor(huggingFaceServiceHealth)}`}>
          <div className="flex items-center">
            <Cpu className={`h-5 w-5 mr-2 ${getServiceStatusIcon(huggingFaceServiceHealth)}`} />
            <div>
              <p className={`text-sm font-medium ${getServiceStatusIcon(huggingFaceServiceHealth).replace('text-', 'text-')}`}>
                {getServiceStatusText(huggingFaceServiceHealth, 'HuggingFace')}
              </p>
              <p className={`text-xs ${getServiceStatusIcon(huggingFaceServiceHealth).replace('text-', 'text-').replace('600', '700')}`}>
                {huggingFaceServiceHealth === null ? 'Checking gemma-3-12b-it...' : huggingFaceServiceHealth ? 'Ready for text extraction' : 'AI model unavailable'}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${getServiceStatusColor(ollamaServiceHealth)}`}>
          <div className="flex items-center">
            <Zap className={`h-5 w-5 mr-2 ${getServiceStatusIcon(ollamaServiceHealth)}`} />
            <div>
              <p className={`text-sm font-medium ${getServiceStatusIcon(ollamaServiceHealth).replace('text-', 'text-')}`}>
                {getServiceStatusText(ollamaServiceHealth, 'Ollama')}
              </p>
              <p className={`text-xs ${getServiceStatusIcon(ollamaServiceHealth).replace('text-', 'text-').replace('600', '700')}`}>
                {ollamaServiceHealth === null ? 'Verifying gemma3 model...' : ollamaServiceHealth ? 'Ready for local processing' : 'Local model unavailable'}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${getServiceStatusColor(openAIServiceHealth)}`}>
          <div className="flex items-center">
            <Box className={`h-5 w-5 mr-2 ${getServiceStatusIcon(openAIServiceHealth)}`} />
            <div>
              <p className={`text-sm font-medium ${getServiceStatusIcon(openAIServiceHealth).replace('text-', 'text-')}`}>
                {getServiceStatusText(openAIServiceHealth, 'OpenAI')}
              </p>
              <p className={`text-xs ${getServiceStatusIcon(openAIServiceHealth).replace('text-', 'text-').replace('600', '700')}`}>
                {openAIServiceHealth === null ? 'Verifying service connection...' : openAIServiceHealth ? 'Ready for template mapping' : 'AI mapping unavailable'}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 ${getServiceStatusColor(supabaseHealth)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Database className={`h-5 w-5 mr-2 ${getServiceStatusIcon(supabaseHealth)}`} />
              <div>
                <p className={`text-sm font-medium ${getServiceStatusIcon(supabaseHealth).replace('text-', 'text-')}`}>
                  {getServiceStatusText(supabaseHealth, 'Supabase')}
                </p>
                <p className={`text-xs ${getServiceStatusIcon(supabaseHealth).replace('text-', 'text-').replace('600', '700')}`}>
                  {supabaseHealth === null ? 'Checking database...' : supabaseHealth ? 'Database ready' : 'Using local storage'}
                </p>
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={testSupabaseConnection}
                disabled={isTesting}
                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                title="Test Connection"
              >
                {isTesting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <TestTube className="h-3 w-3" />
                )}
              </button>
              <button
                onClick={syncToSupabase}
                disabled={isSyncing}
                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                title="Sync to Supabase"
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sync className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Document Upload & Processing</h2>
          <div className="flex items-center space-x-2 text-xs text-blue-600">
            <Zap className="h-4 w-4" />
            <span>Ollama + OpenAI + Template Mapping + Database Sync</span>
          </div>
        </div>
        
        {!selectedFile ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="text-center">
              <FileImage className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Upload Document</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select a document for intelligent processing with template mapping and database sync
              </p>
              {ollamaServiceHealth && openAIServiceHealth && (
                <p className="mt-1 text-xs text-blue-600">
                  Ollama moondream + OpenAI analysis + Automatic template field mapping + Supabase sync
                </p>
              )}
              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!ollamaServiceHealth || !openAIServiceHealth}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Mobile Upload
                </button>
                <button
                  onClick={() => setShowStampAnalyzer(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Stamp className="h-4 w-4 mr-2" />
                  Stamp & Signature Analysis
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Document Preview</h3>
              {renderDocumentPreview()}
              
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAnother}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Select Another
                </button>
                <button
                  onClick={() => {
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setSelectedFile(null);
                    setPreviewUrl('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Processing Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
              
              {isProcessing && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-600">Processing with AI...</span>
                  </div>
                  
                  {processingStage && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">{processingStage}</p>
                    </div>
                  )}
                </div>
              )}

              {!isProcessing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm text-green-800">Ready for processing</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Temporary Documents for Review */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Documents Pending Review</h3>
        
        {temporaryDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No documents pending review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {temporaryDocuments.map((tempDoc) => (
              <div key={tempDoc.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FileImage className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">{tempDoc.originalFile.name}</h4>
                      <p className="text-sm text-gray-500">
                        Processed {new Date(tempDoc.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tempDoc.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                      tempDoc.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {tempDoc.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {Math.round(tempDoc.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>

                {tempDoc.suggestedTemplate && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Matched Template:</span> {tempDoc.suggestedTemplate.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tempDoc.openAIAnalysis.reasoning}
                    </p>
                    <div className="mt-2 flex items-center space-x-2">
                      <span className="text-xs text-blue-600">
                        {Object.keys(tempDoc.extractedFields).length} fields mapped
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-green-600">
                        Template-based extraction
                      </span>
                    </div>
                  </div>
                )}

                {tempDoc.stampSignatureResult && (
                  <div className="mb-3 bg-blue-50 p-2 rounded-md">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <Stamp className="h-3 w-3 mr-1 text-blue-600" />
                        <span className={`text-xs ${tempDoc.stampSignatureResult.Stamp.Status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>
                          {tempDoc.stampSignatureResult.Stamp.Status}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <PenTool className="h-3 w-3 mr-1 text-blue-600" />
                        <span className={`text-xs ${tempDoc.stampSignatureResult.Signature.Status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>
                          {tempDoc.stampSignatureResult.Signature.Status}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Shield className="h-3 w-3 mr-1 text-blue-600" />
                        <span className={`text-xs ${tempDoc.stampSignatureResult.StampValidation === 'Y' ? 'text-green-600' : 'text-red-600'}`}>
                          {tempDoc.stampSignatureResult.StampValidation === 'Y' ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReviewDocument(tempDoc)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Review Modal */}
      {selectedTempDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Review Document</h3>
              <button
                onClick={() => setSelectedTempDoc(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Document Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">Document Information</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div><span className="font-medium">File:</span> {selectedTempDoc.originalFile.name}</div>
                    <div><span className="font-medium">Size:</span> {(selectedTempDoc.originalFile.size / 1024).toFixed(1)} KB</div>
                    <div><span className="font-medium">Confidence:</span> {Math.round(selectedTempDoc.confidence * 100)}%</div>
                    <div><span className="font-medium">Template:</span> {selectedTempDoc.suggestedTemplate?.name || 'None'}</div>
                    <div><span className="font-medium">Fields Mapped:</span> {Object.keys(selectedTempDoc.extractedFields).length}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">AI Analysis</h4>
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p><span className="font-medium">Document Type:</span> {selectedTempDoc.openAIAnalysis.documentType}</p>
                    <p className="mt-2"><span className="font-medium">Reasoning:</span></p>
                    <p className="text-blue-800">{selectedTempDoc.openAIAnalysis.reasoning}</p>
                  </div>
                </div>

                {selectedTempDoc.stampSignatureResult && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">Stamp & Signature Analysis</h4>
                    <div className="bg-blue-50 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium">Stamp Detection:</p>
                          <p className={`${selectedTempDoc.stampSignatureResult.Stamp.Status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedTempDoc.stampSignatureResult.Stamp.Status}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Signature Detection:</p>
                          <p className={`${selectedTempDoc.stampSignatureResult.Signature.Status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedTempDoc.stampSignatureResult.Signature.Status}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Stamp Validation:</p>
                          <p className={`${selectedTempDoc.stampSignatureResult.StampValidation === 'Y' ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedTempDoc.stampSignatureResult.StampValidation === 'Y' ? 'Valid' : 'Invalid'}
                          </p>
                        </div>
                        {selectedTempDoc.stampSignatureResult.MatchedStampType && (
                          <div>
                            <p className="font-medium">Matched Type:</p>
                            <p className="text-green-600">{selectedTempDoc.stampSignatureResult.MatchedStampType}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedTempDoc.openAIAnalysis.fieldMappingDetails && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-md font-medium text-gray-900">Field Mapping Details</h4>
                      <button
                        onClick={() => setShowFieldMappingDetails(!showFieldMappingDetails)}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        {showFieldMappingDetails ? 'Hide' : 'Show'} Details
                      </button>
                    </div>
                    
                    {showFieldMappingDetails && (
                      <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <div className="space-y-2">
                          {selectedTempDoc.openAIAnalysis.fieldMappingDetails.map((detail: any, index: number) => (
                            <div key={index} className="text-xs border-b border-gray-200 pb-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{detail.fieldLabel}</span>
                                <span className={`px-1 py-0.5 rounded text-xs ${getFieldSourceColor(detail.source)}`}>
                                  {detail.source.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-gray-600 mt-1">
                                Confidence: {Math.round(detail.confidence * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">Extracted Text Preview</h4>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-gray-700">{selectedTempDoc.extractedText.substring(0, 300)}...</p>
                  </div>
                </div>
              </div>

              {/* Extracted Fields */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900">Template Fields</h4>
                  {!isEditing ? (
                    <button
                      onClick={handleEditFields}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveEdits}
                        className="inline-flex items-center px-2 py-1 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdits}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTempDoc.suggestedTemplate?.template.map((templateField) => {
                    const fieldValue = isEditing ? editedFields[templateField.id] : selectedTempDoc.extractedFields[templateField.id];
                    const hasValue = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
                    
                    return (
                      <div key={templateField.id} className={`border rounded-lg p-3 ${hasValue ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700 capitalize">
                            {getFieldTypeIcon(templateField.type)} {templateField.label}
                            {templateField.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <div className="flex items-center space-x-1">
                            {hasValue && (
                              <span className="text-xs text-green-600">✓ Mapped</span>
                            )}
                            {!hasValue && templateField.required && (
                              <span className="text-xs text-red-600">Required</span>
                            )}
                          </div>
                        </div>
                        
                        {isEditing ? (
                          templateField.type === 'select' ? (
                            <select
                              value={String(editedFields[templateField.id] || '')}
                              onChange={(e) => setEditedFields(prev => ({ ...prev, [templateField.id]: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select {templateField.label}</option>
                              {templateField.options?.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : templateField.type === 'textarea' ? (
                            <textarea
                              value={String(editedFields[templateField.id] || '')}
                              onChange={(e) => setEditedFields(prev => ({ ...prev, [templateField.id]: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                            />
                          ) : (
                            <input
                              type={templateField.type === 'number' ? 'number' : templateField.type === 'date' ? 'date' : 'text'}
                              value={String(editedFields[templateField.id] || '')}
                              onChange={(e) => setEditedFields(prev => ({ ...prev, [templateField.id]: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )
                        ) : (
                          <p className={`text-sm p-2 rounded ${hasValue ? 'text-gray-900 bg-white' : 'text-gray-500 bg-gray-100 italic'}`}>
                            {hasValue ? String(fieldValue) : 'No data extracted'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isEditing && (
                  <div className="flex space-x-3 pt-4 border-t">
                    <button
                      onClick={handleApproveDocument}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve & Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRejectDocument}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mobile Upload</h3>
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-8 mb-4">
                <QrCode className="h-24 w-24 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">QR Code for mobile upload</p>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Scan this QR code with your mobile device to upload documents directly from your phone camera.
                Documents will be processed with Ollama and OpenAI with automatic template mapping and database sync.
              </p>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}