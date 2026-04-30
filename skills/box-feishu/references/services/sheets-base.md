# 电子表格 & 多维表格

## 电子表格 (sheets)

> Scope: `sheets:spreadsheet:readonly` `sheets:spreadsheet:write`

```bash
# 先查参数结构
lark-cli schema sheets.spreadsheets.values.get

# 创建表格
lark-cli sheets spreadsheets create --data '{"title": "表格标题"}'

# 读取单元格
lark-cli sheets spreadsheets.values get \
  --params '{"spreadsheetToken": "xxx", "range": "Sheet1!A1:C10"}'

# 写入数据（追加行）
lark-cli sheets spreadsheets.values append \
  --data '{"valueRange": {"range": "Sheet1!A1", "values": [["a","b"],["c","d"]]}}'
```

---

## 多维表格 (bitable)

> Scope: `bitable:app:readonly` `bitable:app:write`

```bash
# 先查参数
lark-cli schema bitable.apps.tables.records.list

# 列出记录
lark-cli bitable apps.tables.records list \
  --params '{"app_token": "xxx", "table_id": "tbl_xxx"}'

# 新增记录
lark-cli bitable apps.tables.records create \
  --data '{"app_token":"xxx","table_id":"tbl_xxx","record":{"fields":{"字段名":"值"}}}'

# 查询记录（带过滤）
lark-cli bitable apps.tables.records search \
  --data '{"app_token":"xxx","table_id":"tbl_xxx","filter":{"conditions":[]}}'
```
