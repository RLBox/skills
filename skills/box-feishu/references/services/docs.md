# 云文档 (docs)

> Scope: `docx:document:readonly` `docx:document:write`

```bash
# 读取文档（返回 Markdown）
lark-cli docs +fetch --doc <url_or_token>

# 搜索文档（也可搜表格、wiki）
lark-cli docs +search --query "关键词"

# 创建文档
lark-cli docs +create --title "文档标题" --markdown "# 内容"

# 更新文档（追加）
lark-cli docs +update --doc <url_or_token> --mode append --markdown "新内容"

# 更新文档（覆盖）
lark-cli docs +update --doc <url_or_token> --mode overwrite --markdown "新内容"

# 插入图片/文件到文档末尾
lark-cli docs +media-insert --doc <url_or_token> --file ./image.png
```

## URL 与 Token 对照

| URL 格式 | 处理方式 |
|----------|---------|
| `/docx/TOKEN` | 直接用 |
| `/doc/TOKEN` | 直接用 |
| `/wiki/TOKEN` | ⚠️ 须先查真实 obj_token（见知识库章节） |
| `/sheets/TOKEN` | 直接用 |
| `/drive/folder/TOKEN` | 作为 folder_token |
