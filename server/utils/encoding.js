const iconv = require('iconv-lite');
const logger = require('../config/logger');

/**
 * Function to detect and fix encoding issues in ZIP entry names using raw bytes
 */
function fixEncodingIssues(entryName, rawBytes = null) {
    // First check if the entry name already looks correct (contains proper Russian characters)
    const hasProperRussian = /[А-Яа-яЁё]/.test(entryName);
    const hasCorruption = /[�����������������������������]/.test(entryName) || /[\u0B80-\u0BFF]/.test(entryName);
    
    // If we have raw bytes and the entry name appears corrupted, try to decode from raw bytes
    if (rawBytes && (hasCorruption || !hasProperRussian)) {
        try {
            // Try different encodings commonly used for Russian text
            const encodingsToTry = ['cp866', 'windows-1251', 'koi8-r', 'iso-8859-5'];
            
            for (const encoding of encodingsToTry) {
                try {
                    const decoded = iconv.decode(Buffer.from(rawBytes), encoding);
                    // Check if the decoded text contains valid Russian characters and is better than original
                    if (/[А-Яа-яЁё]/.test(decoded) && !/�/.test(decoded) && decoded !== entryName) {
                        logger.info('Successfully decoded entry name from raw bytes', {
                            original: entryName,
                            fixed: decoded,
                            encoding: encoding
                        });
                        return decoded;
                    }
                } catch (e) {
                    // Continue to next encoding
                }
            }
        } catch (error) {
            logger.warn('Failed to decode raw bytes', { error: error.message });
        }
    }
    
    // If the filename already has proper Russian characters and no corruption, return as-is
    if (hasProperRussian && !hasCorruption) {
        return entryName;
    }
    
    // Fallback: try to fix already corrupted Unicode strings
    if (hasCorruption) {
        try {
            // Try to decode the string as if it was incorrectly interpreted
            const bytes = [];
            for (let i = 0; i < entryName.length; i++) {
                const charCode = entryName.charCodeAt(i);
                if (charCode === 0xFFFD) {
                    // Skip replacement characters as they've lost original info
                    continue;
                } else if (charCode < 256) {
                    bytes.push(charCode);
                }
            }
            
            if (bytes.length > 0) {
                const buffer = Buffer.from(bytes);
                
                // Try different encodings
                const encodingsToTry = ['cp866', 'windows-1251'];
                for (const encoding of encodingsToTry) {
                    try {
                        const decoded = iconv.decode(buffer, encoding);
                        if (/[А-Яа-яЁё]/.test(decoded)) {
                            logger.info('Fixed corrupted entry name', {
                                original: entryName,
                                fixed: decoded,
                                encoding: encoding
                            });
                            return decoded;
                        }
                    } catch (e) {
                        // Continue to next encoding
                    }
                }
            }
            
            // Last resort: try to fix specific known corrupted patterns
            let fixedName = entryName;
            
            // Handle specific Tamil characters that represent corrupted Russian text
            const specificMappings = {
                'ப': 'р',
                '஢': 'к',
                '஧': 'з'
            };
            
            Object.keys(specificMappings).forEach(corrupted => {
                const regex = new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                fixedName = fixedName.replace(regex, specificMappings[corrupted]);
            });
            
            return fixedName;
            
        } catch (error) {
            logger.warn('Failed to fix encoding for entry name', { entryName, error: error.message });
        }
    }
    
    return entryName;
}

/**
 * Additional server-side text correction
 */
function fixCorruptedRussianTextServer(text) {
    // Add any additional server-specific text corrections here
    return text;
}

module.exports = {
    fixEncodingIssues,
    fixCorruptedRussianTextServer
};