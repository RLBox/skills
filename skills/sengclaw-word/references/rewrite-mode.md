# 净改写模式（Rewrite Mode）

用于对 Word 文档做**文字净替换**：批量改名、统一简称、改写条款文字。改完后文档内容直接变化，无删除线/批注痕迹，适合交付版文档。

## 核心工具

`scripts/word_rewriter.py` — 直接操作 OpenXML，无需 lxml，只用 Python 标准库。

```bash
python3 "SKILL_DIR/scripts/word_rewriter.py" <input.docx> <rewrite.json> [output.docx]
```

- 输出默认为 `原文件名_rewritten.docx`
- 无需安装任何额外依赖

---

## rewrite.json 格式

```json
{
  "preserve": [
    "需要保留、不被替换的片段（精确字符串）"
  ],
  "replacements": [
    {
      "old": "要替换的旧文字",
      "new": "替换为的新文字",
      "node_prefix": true
    }
  ],
  "injections": [
    {
      "anchor": "锚定文字（全文唯一，新段落插在它前面）",
      "text": "要注入的新段落文字"
    }
  ],
  "forbidden": [
    "替换后不应出现的词（用于验证）"
  ]
}
```

所有字段均可选，按需填写。

### `node_prefix` 说明

Word 会把一句话**拆分到多个 `<w:t>` 节点**（字体切换、输入法历史等导致），例如：

```xml
<w:r><w:t>OpenClacky 应用错误体系检测平台</w:t></w:r>
<w:r><w:t>企业版账号及环境的开通</w:t></w:r>
```

视觉上是一整句，XML 里却被拆了。设置 `"node_prefix": true` 后，脚本会**同时**处理 `>旧文字<` 形式的孤立节点，避免漏替换。

脚本执行后会自动做**重复词检测**，发现「企业版企业版」等情况会打印 `[WARN]`，需手动加一条替换修复（见下方示例）。

---

## 工作流

### 第一步：读取文档内容（确认要改什么）

```python
import re, zipfile
with zipfile.ZipFile('input.docx') as z:
    xml = z.read('word/document.xml').decode('utf-8')
texts = re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml)
for t in texts:
    if t.strip():
        print(repr(t))
```

或者直接运行脚本，它会打印所有操作日志，方便确认替换范围。

### 第二步：编写 rewrite.json

根据文档内容和用户需求，填写四个字段：

| 字段 | 用途 |
|------|------|
| `preserve` | 锁住不想改的片段（如合同标题、价格表备注） |
| `replacements` | 批量替换规则，按顺序执行 |
| `injections` | 在指定锚点前插入新段落 |
| `forbidden` | 替换后验证不含的词 |

### 第三步：执行

```bash
python3 "SKILL_DIR/scripts/word_rewriter.py" input.docx rewrite.json output.docx
```

正常输出示例：

```
── 占位符保护（2 条）──
── 批量替换（1 条规则）──
[OK] 替换: 'OpenClacky 应用错误体系检测平台企业版' → 'OpenClacky 企业版'
[INFO] 共完成 1 条替换
[OK] 还原占位符 2 条
── 段落注入（1 条）──
[OK] 注入段落（锚点: '乙方为甲方提供如下服务：'）
── 重复词检测 ──
[OK] 未检测到重复词
── 危险词验证（3 个）──
[OK]   已清除: 'AI Code Review'
[DONE] 输出文件: output.docx
```

**出现 `[WARN]` 时**：
- `未找到替换目标` → `old` 字段与文档内容不完全一致，用第一步提取文本对照
- `疑似重复词` → 拆分节点导致，在 `replacements` 里加一条修复规则，例如：
  ```json
  { "old": "企业版账号及环境的开通", "new": "账号及环境的开通" }
  ```

---

## 完整案例：合同简称统一

> 背景：金蝶产品订阅合同，将「OpenClacky 应用错误体系检测平台企业版」全部改为「OpenClacky 企业版」，保留标题和价格表中的全称，并在正文开头注入简称定义。

```json
{
  "preserve": [
    "OpenClacky 应用错误体系检测平台企业版产品订阅合同",
    "OpenClacky 应用错误体系检测平台企业版年度订阅（含代码缺陷智能检测、异常链路分析、研发质量门禁，研发团队不限人数，一年授权）"
  ],
  "replacements": [
    {
      "old": "OpenClacky 应用错误体系检测平台企业版",
      "new": "OpenClacky 企业版",
      "node_prefix": true
    }
  ],
  "injections": [
    {
      "anchor": "乙方为甲方提供如下服务：",
      "text": "本合同所称\"OpenClacky 企业版\"，即 OpenClacky 应用错误体系检测平台企业版，下文均以简称表述。"
    }
  ],
  "forbidden": [
    "OpenClacky 应用错误体系检测平台企业版订阅",
    "AI Code Review",
    "代码智能补全"
  ]
}
```

执行：
```bash
python3 "SKILL_DIR/scripts/word_rewriter.py" 合同.docx rewrite.json 合同_final.docx
```

---

## 注入段落的注意事项

- `anchor` 选全文唯一的文字，避免多处匹配导致意外插入
- 注入的新段落没有 `<w:pPr>` 样式，会继承默认正文样式。如需特定字体/缩进，需在脚本 `apply_injections()` 函数中手动复制相邻段落的 `<w:pPr>` 节点
- `xml:space="preserve"` 已在脚本中自动处理，不需要手动加
