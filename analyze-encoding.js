// Script to analyze the specific encoding issue and create proper mappings

const garbledText = '�ப 9. �஢�� ��������';
const correctText = 'Урок 9. Уровни Фиббоначи';

console.log('Analyzing encoding issue...');
console.log('Garbled text:', garbledText);
console.log('Correct text:', correctText);
console.log('');

// Analyze byte values of garbled text
console.log('Garbled text byte analysis:');
for (let i = 0; i < garbledText.length; i++) {
    const char = garbledText[i];
    const charCode = char.charCodeAt(0);
    const hex = charCode.toString(16).padStart(4, '0');
    console.log(`"${char}" -> Unicode: U+${hex.toUpperCase()} (${charCode})`);
}

console.log('');

// Analyze byte values of correct text
console.log('Correct text byte analysis:');
for (let i = 0; i < correctText.length; i++) {
    const char = correctText[i];
    const charCode = char.charCodeAt(0);
    const hex = charCode.toString(16).padStart(4, '0');
    console.log(`"${char}" -> Unicode: U+${hex.toUpperCase()} (${charCode})`);
}

console.log('');

// Create character mapping
console.log('Creating character mapping:');
const mapping = {};

// Extract just the Cyrillic characters from both strings
const garbledCyrillic = garbledText.match(/[^\w\s.]/g) || [];
const correctCyrillic = correctText.match(/[А-Яа-яЁё]/g) || [];

console.log('Garbled Cyrillic chars:', garbledCyrillic);
console.log('Correct Cyrillic chars:', correctCyrillic);

// Try to create a direct mapping
console.log('Direct character mapping:');
for (let i = 0; i < Math.min(garbledCyrillic.length, correctCyrillic.length); i++) {
    const garbled = garbledCyrillic[i];
    const correct = correctCyrillic[i];
    mapping[garbled] = correct;
    console.log(`"${garbled}" (U+${garbled.charCodeAt(0).toString(16).toUpperCase()}) -> "${correct}" (U+${correct.charCodeAt(0).toString(16).toUpperCase()})`);
}

console.log('');
console.log('Generated mapping object:');
console.log(JSON.stringify(mapping, null, 2));

// Test the mapping
function testMapping(text, mapping) {
    let result = text;
    Object.keys(mapping).forEach(garbled => {
        const regex = new RegExp(garbled.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, mapping[garbled]);
    });
    return result;
}

const testResult = testMapping(garbledText, mapping);
console.log('');
console.log('Test mapping result:');
console.log(`Original: "${garbledText}"`);
console.log(`Fixed:    "${testResult}"`);
console.log(`Expected: "${correctText}"`);
console.log(`Success:  ${testResult === correctText}`);

// Generate the fix function code
console.log('');
console.log('=== Character mapping for implementation ===');
console.log('const specificMapping = {');
Object.keys(mapping).forEach(key => {
    console.log(`  "${key}": "${mapping[key]}",`);
});
console.log('};');