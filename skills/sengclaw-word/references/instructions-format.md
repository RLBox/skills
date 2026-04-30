# instructions.json 格式说明

`word_editor.py` 通过一个 JSON 文件接收操作指令。

## 完整格式

```json
{
  "comments": [
    {
      "target_text": "段落中包含的文字（用于定位段落，不必是全文）",
      "comment": "批注内容，显示在 Word/WPS 批注栏"
    }
  ],
  "revisions": [
    {
      "old_text": "要删除/替换的原文（精确匹配）",
      "new_text": "替换为的新文字；留空字符串则为纯删除"
    }
  ]
}
```

## 示例

```json
{
  "comments": [
    {
      "target_text": "租赁期限为三年",
      "comment": "【风险提示】未约定提前解除条款，建议补充。"
    },
    {
      "target_text": "违约金为合同总价的10%",
      "comment": "【建议】违约金比例偏低，建议提高至20%。"
    }
  ],
  "revisions": [
    {
      "old_text": "甲方不承担任何责任",
      "new_text": "甲方依法承担相应责任"
    },
    {
      "old_text": "本合同一式一份",
      "new_text": "本合同一式两份，甲乙双方各执一份"
    },
    {
      "old_text": "此条款不可更改",
      "new_text": ""
    }
  ]
}
```

## 注意事项

- `target_text` / `old_text` 只需包含段落中的部分文字即可，脚本会找到首次匹配的段落
- `old_text` 精确匹配，注意空格和标点
- `new_text` 为空字符串时，表示纯删除（Word 显示红色删除线，无插入内容）
- 每条修订只处理文档中首次匹配的段落
- 批注和修订可以同时存在，互不干扰
