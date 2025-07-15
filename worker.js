const ALPHABET = ['咕', '嘎', '🐧', '🍄', '哇擦'];
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function generateEncodingTable() {
  const table = [];
  for (let i = 0; i < 64; i++) {
    let n = i;
    const d2 = Math.floor(n / 25);
    n %= 25;
    const d1 = Math.floor(n / 5);
    const d0 = n % 5;
    table.push(ALPHABET[d2] + ALPHABET[d1] + ALPHABET[d0]);
  }
  return table;
}

const encodingTable = generateEncodingTable();

const decodingTable = (() => {
  const table = {};
  encodingTable.forEach((code, index) => {
    table[code] = index;
  });
  return table;
})();

const base64IndexMap = (() => {
    const map = {};
    for(let i=0; i<BASE64_CHARS.length; i++) {
        map[BASE64_CHARS[i]] = i;
    }
    return map;
})();

function encodeCustomBase64(input) {
  const utf8Bytes = new TextEncoder().encode(input);
  let binary = '';
  utf8Bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);

  const customEncodedParts = [];
  for (let i = 0; i < base64.length; i++) {
    const char = base64.charAt(i);
    if (char === '=') {
      continue;
    }
    const index = base64IndexMap[char];
    if (index !== undefined) {
      customEncodedParts.push(encodingTable[index]);
    }
  }
  return customEncodedParts.join('');
}

function decodeCustomBase64(input) {
  const tokens = [];
  const sortedAlphabet = [...ALPHABET].sort((a, b) => b.length - a.length);
  let pos = 0;
  while (pos < input.length) {
      let found = false;
      for (const token of sortedAlphabet) {
          if (input.startsWith(token, pos)) {
              tokens.push(token);
              pos += token.length;
              found = true;
              break;
          }
      }
      if (!found) {
          throw new Error('输入包含无效的字符组合');
      }
  }

  if (tokens.length % 3 !== 0) {
    throw new Error('输入长度无效，无法按3个符号分组');
  }

  const codes = [];
  for (let i = 0; i < tokens.length; i += 3) {
    codes.push(tokens.slice(i, i + 3).join(''));
  }

  const base64Chars = [];
  for (const code of codes) {
    const index = decodingTable[code];
    if (index !== undefined) {
      base64Chars.push(BASE64_CHARS[index]);
    } else {
        throw new Error(`无法解码的符号组合: "${code}"`);
    }
  }
  let base64 = base64Chars.join('');
  
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(paddingNeeded);
  
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    throw new Error('Base64解码失败: ' + e.message);
  }
}

// Worker消息处理器
self.onmessage = function(e) {
  const { type, input } = e.data; // input is ArrayBuffer
  try {
    const inputText = new TextDecoder().decode(input);
    let resultText;
    if (type === 'encode') {
      resultText = encodeCustomBase64(inputText);
    } else if (type === 'decode') {
      resultText = decodeCustomBase64(inputText);
    }
    const resultBytes = new TextEncoder().encode(resultText).buffer;
    self.postMessage({ status: 'success', type, result: resultBytes }, [resultBytes]);
  } catch (error) {
    // Error messages are strings, no need to encode
    self.postMessage({ status: 'error', type, message: error.message });
  }
}; 