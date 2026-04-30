# Obsidian Bases（.base 文件）

## 工作流

1. 创建 `.base` 文件（有效 YAML 内容）
2. 用 `filters` 选定显示哪些笔记（按 tag/folder/property/date）
3. 用 `formulas` 定义计算属性（可选）
4. 用 `views` 配置显示方式（`table`/`cards`/`list`/`map`）
5. 验证 YAML 无语法错误
6. 在 Obsidian 中打开确认渲染正确

## 完整 Schema 示例

```yaml
filters:
  and:
    - 'file.hasTag("project")'
    - 'status == "active"'

formulas:
  age: 'today() - date'

views:
  - type: table
    name: "Active Projects"
    order:
      - file.name
      - status
      - formula.age
  - type: cards
    name: "Card View"
```

## Filter 语法

```yaml
# 单一过滤
filters: 'status == "done"'

# AND
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'

# OR
filters:
  or:
    - 'file.hasTag("book")'
    - 'file.hasTag("article")'

# NOT
filters:
  not:
    - 'file.hasTag("archived")'
```

## 常用 Filter 函数

| 函数 | 说明 |
|------|------|
| `file.hasTag("tag")` | 包含指定 tag |
| `file.inFolder("folder")` | 在指定目录 |
| `file.hasLink("note")` | 链接到指定笔记 |
| `file.name` | 文件名 |
| `file.ctime` | 创建时间 |
| `file.mtime` | 修改时间 |
| `today()` | 今天日期 |

## 视图类型

| 类型 | 说明 |
|------|------|
| `table` | 表格视图 |
| `cards` | 卡片视图 |
| `list` | 列表视图 |
| `map` | 地图视图（需地理属性） |
