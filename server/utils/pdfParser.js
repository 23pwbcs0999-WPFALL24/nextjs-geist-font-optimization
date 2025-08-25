const pdf = require('pdf-parse');

/**
 * Extract text from PDF buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdf(pdfBuffer);
    
    return {
      success: true,
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info,
        version: data.version
      }
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      error: error.message,
      text: null,
      metadata: null
    };
  }
};

/**
 * Clean and format extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
const cleanExtractedText = (text) => {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers and headers/footers (basic patterns)
    .replace(/^\d+\s*$/gm, '')
    // Remove excessive line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
};

/**
 * Extract key information from text
 * @param {string} text - Cleaned text
 * @returns {Object} - Key information extracted
 */
const extractKeyInfo = (text) => {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
  
  // Extract potential headings (lines that are short and may be titles)
  const lines = text.split('\n');
  const potentialHeadings = lines
    .filter(line => line.length > 0 && line.length < 100 && !line.includes('.'))
    .slice(0, 10); // First 10 potential headings
  
  return {
    wordCount,
    readingTime,
    potentialHeadings,
    characterCount: text.length,
    paragraphCount: text.split('\n\n').length
  };
};

/**
 * Process PDF file completely
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} - Complete processing result
 */
const processPDF = async (pdfBuffer) => {
  try {
    // Extract text
    const extractionResult = await extractTextFromPDF(pdfBuffer);
    
    if (!extractionResult.success) {
      return extractionResult;
    }
    
    // Clean text
    const cleanedText = cleanExtractedText(extractionResult.text);
    
    // Extract key information
    const keyInfo = extractKeyInfo(cleanedText);
    
    return {
      success: true,
      originalText: extractionResult.text,
      cleanedText,
      metadata: extractionResult.metadata,
      keyInfo
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  extractTextFromPDF,
  cleanExtractedText,
  extractKeyInfo,
  processPDF
};
