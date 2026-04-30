---
name: sengclaw-word
description: 'Word/WPS 文档处理技能，支持两种模式：（1）批注与修订模式（Redline）— 给文档添加批注气泡和修订标记（Track Changes），适合审阅合同、律师审核、保留修改痕迹；（2）净改写模式（Rewrite）— 对文档做无痕文字替换，批量改名/统一简称/改写条款，输出干净交付版。当用户给出 .docx 文件并提出修改意见、需要审阅批注、需要批量替换文字、统一简称、改写合同文本、在文档中注入新段落时使用本技能。'
disable-model-invocation: false
user-invocable: true
---

# sengclaw-word — Word 文档处理

本技能支持两种模式，根据用户需求选择：

| 模式 | 适用场景 | 参考文档 |
|------|---------|---------|
| **批注与修订（Redline）** | 审阅合同、添加批注气泡、Track Changes 修订标记、保留修改痕迹 | `references/redline-mode.md` |
| **净改写（Rewrite）** | 批量替换文字、统一简称、改写条款、无痕交付版文档 | `references/rewrite-mode.md` |

## 快速判断

- 用户说「帮我审一下」「加批注」「标出问题」「Track Changes」→ **Redline 模式**
- 用户说「把 XX 全部改成 YY」「统一简称」「改写这段」「输出干净版」→ **Rewrite 模式**

## 依赖

```bash
pip install lxml   # Redline 模式需要
```

Rewrite 模式直接操作 XML，只用 Python 标准库，无需额外依赖。

## 支持文件

- `scripts/word_editor.py` — Redline 模式核心脚本（批注 + 修订，需 lxml）
- `scripts/word_rewriter.py` — Rewrite 模式核心脚本（净改写，纯标准库）
- `references/redline-mode.md` — 批注与修订模式完整工作流
- `references/rewrite-mode.md` — 净改写模式完整工作流（含 rewrite.json 格式、拆分节点陷阱、危险词验证）
- `references/instructions-format.md` — instructions.json 格式说明（Redline 模式用）
