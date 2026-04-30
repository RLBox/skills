# JSON Canvas（.canvas 文件）

## 基本结构

```json
{
  "nodes": [...],
  "edges": [...]
}
```

## 节点类型

### 文本节点
```json
{
  "id": "node1",
  "type": "text",
  "text": "## Hello\nMarkdown content here",
  "x": 0,
  "y": 0,
  "width": 400,
  "height": 200,
  "color": "1"
}
```

### 文件节点（链接到 vault 中的笔记）
```json
{
  "id": "node2",
  "type": "file",
  "file": "folder/note.md",
  "x": 500,
  "y": 0,
  "width": 400,
  "height": 200
}
```

### 链接节点（外部 URL）
```json
{
  "id": "node3",
  "type": "link",
  "url": "https://example.com",
  "x": 0,
  "y": 300,
  "width": 400,
  "height": 200
}
```

### 分组节点
```json
{
  "id": "group1",
  "type": "group",
  "label": "Group Label",
  "x": -50,
  "y": -50,
  "width": 500,
  "height": 350
}
```

## 连线（Edges）

```json
{
  "id": "edge1",
  "fromNode": "node1",
  "fromSide": "right",
  "toNode": "node2",
  "toSide": "left",
  "label": "connects to",
  "color": "2",
  "fromEnd": "none",
  "toEnd": "arrow"
}
```

- **Side 可选值**：`top` `right` `bottom` `left`
- **End 可选值**：`none` `arrow`

## 颜色参考

| 值 | 颜色 |
|----|------|
| `"1"` | 红色 |
| `"2"` | 橙色 |
| `"3"` | 黄色 |
| `"4"` | 绿色 |
| `"5"` | 青色 |
| `"6"` | 紫色 |
| `#hex` | 自定义颜色 |
