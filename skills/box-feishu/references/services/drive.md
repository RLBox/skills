# 云空间 (drive)

> Scope: `drive:drive:readonly` `drive:file:download` `drive:file:upload`

```bash
# 列出云空间文件
lark-cli api GET /open-apis/drive/v1/files

# 获取文件元数据（批量，含 URL）
lark-cli drive metas batch_query --data '{"request_docs": [{"doc_type": "docx", "doc_token": "<token>"}], "with_url": true}'

# 下载文件
lark-cli drive +download --file-token <token> --output ./local_file.docx

# 上传文件
lark-cli drive +upload --file ./local.pdf --folder-token <folder_token>

# 添加文档评论
lark-cli drive +add-comment --file <url_or_token> --content '[{"type":"text","text":"评论内容"}]'
```
