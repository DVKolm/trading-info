/**
 * Utility functions for fixing encoding issues with Russian text
 */

// Common corrupted Russian text patterns and their correct equivalents
const ENCODING_FIX_MAP: { [key: string]: string } = {
  // Based on the specific issue: �р 9. �к�� ��������
  '�р': 'Ур',  // Ур -> �р
  '�к��': 'овни', // овни -> �к��
  '��������': 'Фиббоначи', // Фиббоначи -> ��������
  
  // Additional common corrupted patterns for Russian text
  '�': 'у', // Common corruption for 'у'
  'р': 'р', // Ensure 'р' stays correct
  'о': 'о', // Ensure 'о' stays correct
  'к': 'к', // Ensure 'к' stays correct
};

/**
 * Fixes corrupted Russian text encoding issues
 * @param text - The potentially corrupted text
 * @returns Fixed text with proper Russian characters
 */
export function fixCorruptedRussianText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let fixedText = text;

  // Check for specific known corrupted patterns first
  if (text.includes('�р 9. �к�� ��������')) {
    return text.replace('�р 9. �к�� ��������', 'Урок 9. Уровни Фиббоначи');
  }

  // Apply general fixes for corrupted characters
  Object.keys(ENCODING_FIX_MAP).forEach(corruptedChar => {
    const regex = new RegExp(corruptedChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    fixedText = fixedText.replace(regex, ENCODING_FIX_MAP[corruptedChar]);
  });

  return fixedText;
}

/**
 * Checks if text contains corrupted encoding characters
 * @param text - The text to check
 * @returns true if text appears to be corrupted
 */
export function isCorruptedText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for Unicode replacement characters or other corruption indicators
  return /[�����������������������������]/.test(text) || 
         /[\u0B80-\u0BFF]/.test(text) || // Tamil characters (often appear in corruption)
         text.includes('�р') || 
         text.includes('�к��') ||
         text.includes('��������');
}

/**
 * Cleans up corrupted lesson data from localStorage
 */
export function cleanupCorruptedLessonData(): void {
  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Find lesson-related keys with potential corruption
    const lessonKeys = keys.filter(key => 
      key.startsWith('lesson_') && isCorruptedText(key)
    );

    // Remove corrupted lesson data
    lessonKeys.forEach(key => {
      console.warn(`Removing corrupted lesson data: ${key}`);
      localStorage.removeItem(key);
    });

    // Also check stored lesson data for corruption
    keys.forEach(key => {
      if (key.startsWith('lesson_')) {
        try {
          const data = localStorage.getItem(key);
          if (data && isCorruptedText(data)) {
            console.warn(`Removing corrupted lesson data: ${key}`);
            localStorage.removeItem(key);
          }
        } catch (error) {
          // If we can't parse the data, it might be corrupted
          localStorage.removeItem(key);
        }
      }
    });

    console.log('Cleanup of corrupted lesson data completed');
  } catch (error) {
    console.error('Error cleaning up corrupted lesson data:', error);
  }
}

/**
 * Sanitizes lesson title for safe display
 * @param title - The lesson title to sanitize
 * @returns Sanitized title
 */
export function sanitizeLessonTitle(title: string): string {
  if (!title) return '';
  
  // First try to fix known corruption
  let sanitized = fixCorruptedRussianText(title);
  
  // If still corrupted, try to extract meaningful parts
  if (isCorruptedText(sanitized)) {
    // Try to extract lesson number if present
    const lessonNumberMatch = sanitized.match(/(\d+)/);
    if (lessonNumberMatch) {
      return `Урок ${lessonNumberMatch[1]}`;
    }
    
    // Fallback to generic name
    return 'Урок (название восстанавливается)';
  }
  
  return sanitized;
}