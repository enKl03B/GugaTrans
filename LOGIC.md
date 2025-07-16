# GugaTrans 处理逻辑说明

本文档详细阐述了 GugaTrans 企鹅语转换工具的核心编码和解码逻辑，以及为提升性能所做的技术实现。

## 1. 自定义 Base64 字符集

GugaTrans 使用一套独特的“企鹅语”字符集来表示标准 Base64 的 64 个符号：

`const ALPHABET = ['咕', '嘎', '🐧', '🍄', '哇擦'];`

编码表 `encodingTable` 是通过组合这五个字符生成的，确保每个标准 Base64 字符（A-Z, a-z, 0-9, +, /）都唯一对应一个三字符的“企鹅语”组合。生成逻辑如下：

```javascript
function generateEncodingTable() {
  const table = [];
  for (let i = 0; i < 64; i++) {
    let n = i;
    const d2 = Math.floor(n / 25); // 第一位字符的索引 (0-2)
    n %= 25;
    const d1 = Math.floor(n / 5);  // 第二位字符的索引 (0-4)
    const d0 = n % 5;             // 第三位字符的索引 (0-4)
    table.push(ALPHABET[d2] + ALPHABET[d1] + ALPHABET[d0]);
  }
  return table;
}
```

`decodingTable` 则是 `encodingTable` 的反向映射，用于将“企鹅语”组合转换回对应的标准 Base64 索引。

## 2. 编码流程 (`encodeCustomBase64`)

1.  **UTF-16 到 UTF-8 字节**: 使用 `TextEncoder` 将用户输入的 JavaScript UTF-16 字符串转换为 UTF-8 字节数组。
2.  **UTF-8 字节到标准 Base64**: 将 UTF-8 字节数组转换为二进制字符串，然后使用 `btoa()` 函数进行标准 Base64 编码。
3.  **标准 Base64 到自定义企鹅语**: 遍历标准 Base64 字符串，忽略填充字符 `=`。对于每个标准 Base64 字符，查找其在 `BASE64_CHARS` 中的索引，然后使用 `encodingTable` 将其映射为对应的三字符“企鹅语”组合。
4.  **拼接结果**: 将所有“企鹅语”组合拼接成最终的编码字符串。

## 3. 解码流程 (`decodeCustomBase64`)

1.  **词法分析（分词）**: 由于每个“企鹅语”编码都是固定三个字符的组合，通过正则匹配 `/.{1,3}/g` 可以高效地将输入的“企鹅语”字符串分割成独立的编码组合（例如 `咕嘎嘎`）。
2.  **自定义企鹅语到标准 Base64**: 遍历分割后的“企鹅语”组合。对于每个组合，使用 `decodingTable` 查找其对应的标准 Base64 索引，然后通过 `BASE64_CHARS` 映射回标准 Base64 字符。
3.  **添加填充字符**: 根据标准 Base64 规范，计算并添加必要的 `=` 填充字符，确保 Base64 字符串的长度是 4 的倍数。
4.  **标准 Base64 到 UTF-8 字节**: 使用 `atob()` 函数将标准 Base64 字符串解码为二进制字符串，然后将其转换为 `Uint8Array` 字节数组。
5.  **UTF-8 字节到 UTF-16 字符串**: 最后，使用 `TextDecoder` 将 UTF-8 字节数组解码回原始的 UTF-16 JavaScript 字符串。

## 4. 性能优化 (Web Worker & ArrayBuffer)

为了解决在处理大量文本时网页卡顿的问题，GugaTrans 采用了以下性能优化策略：

-   **Web Workers**: 所有的编码和解码核心逻辑都已从主线程转移到独立的 Web Worker 线程中运行。这意味着这些计算密集型任务不会阻塞主线程，确保了用户界面的流畅性和响应速度。
-   **ArrayBuffer 数据传输**: 在主线程和 Web Worker 之间传递大量文本数据时，不再进行传统的字符串复制，而是利用 `ArrayBuffer` 进行数据传输。`ArrayBuffer` 是一种可转移对象（Transferable Object），可以在不同线程之间进行零拷贝（zero-copy）数据转移，大大减少了数据序列化和反序列化的开销，从而显著提升了大数据量处理的性能。

## 5. 字数限制与 Emoji 处理

-   **字数限制**: 输入框设定了 5000 字的上限。当用户输入的文本超出此限制时，系统不会立即截断，而是在用户点击“编码”或“解码”按钮时执行截断操作，仅处理前 5000 个字符。这在防止极端性能问题的同时，也给予用户编辑超长文本的机会。
-   **Emoji 兼容性**: 针对 JavaScript 字符串 `.length` 属性无法正确处理多字节字符（如 Emoji）的问题，本工具在进行字数统计和文本截断时，统一使用 `Array.from(string)` 方法将字符串转换为字符数组。这确保了每个独立的字符（包括复杂的 Emoji 表情）都被正确识别为一个单元，从而避免了内容损坏。 