# 批注与修订模式（Redline Mode）

用于给 Word 文档添加**批注（Comments）**和**修订（Track Changes）**，不改变文档最终呈现，适合审阅、法律合同审核等场景。

## 核心工具

`scripts/word_editor.py` — 直接操作 OpenXML，向 .docx 写入批注和修订。

```bash
python3 "SKILL_DIR/scripts/word_editor.py" <input.docx> <instructions.json> [output.docx]
```

- 输出默认为 `原文件名_reviewed.docx`
- 作者信息自动从文档 `docProps/core.xml` 读取（兼容 Word 和 WPS）
- 依赖：`pip install lxml`

## 工作流

### 第一步：理解用户意图

用户可能以两种方式表达需求：

**A. 明确指令**
「删除第三条'甲方不承担责任'，改成'甲方依法承担责任'」
「在违约金条款加批注，提示风险」

**B. 角色扮演**
「你是一名律师，帮我审这份合同」→ 先读文档，自行找问题，再生成指令

### 第二步：读取文档内容（角色扮演时用）

```python
python3 -c "
import zipfile
from lxml import etree
with zipfile.ZipFile('input.docx') as z:
    xml = z.read('word/document.xml')
root = etree.fromstring(xml)
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
texts = [t.text for t in root.iter(f'{{{W}}}t') if t.text]
print(''.join(texts))
"
```

### 第三步：生成 instructions.json

根据用户意见或自主审查结果，生成指令文件。

**批注**：标注问题、提出建议、风险提示，不改动原文
**修订**：实际修改文字，Word 显示删除线 + 新增内容

```json
{
  "comments": [
    {
      "target_text": "租赁期限为三年",
      "comment": "【风险提示】未约定提前解除条款，建议补充。"
    }
  ],
  "revisions": [
    {
      "old_text": "甲方不承担任何责任",
      "new_text": "甲方依法承担相应责任"
    },
    {
      "old_text": "此条款不可更改",
      "new_text": ""
    }
  ]
}
```

注意：
- `target_text` / `old_text` 只需包含段落中的部分文字即可，脚本找首次匹配段落
- `old_text` 精确匹配，注意空格和标点
- `new_text` 为空字符串 = 纯删除（Word 显示红色删除线，无插入内容）

### 第四步：执行并输出

```bash
python3 "SKILL_DIR/scripts/word_editor.py" input.docx instructions.json output_reviewed.docx
```

检查输出：
- 无报错 → 发送给用户
- `[WARN] 未找到...` → 检查 `target_text` / `old_text` 是否与文档内容精确匹配

## word_editor.py 内部原理（备查）

- **批注**：向 `word/comments.xml` 写入 `<w:comment>` 节点，并在对应段落首尾插入 `<w:commentRangeStart>` / `<w:commentRangeEnd>` / `<w:commentReference>`
- **修订**：在段落内定位 old_text，拆分相关 `<w:r>` run，用 `<w:del>` + `<w:ins>` 节点替换，保留原有 `<w:rPr>` 格式属性
- **打包**：`[Content_Types].xml` 必须是 zip 的第一个条目（兼容性要求），`pack_docx()` 已处理
