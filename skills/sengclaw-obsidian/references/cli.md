# Obsidian CLI 命令参考

Run `obsidian help` to see all available commands.
Full docs: https://help.obsidian.md/cli

## 语法说明

- `file=<name>` — 解析方式类似 wikilink（只需名字，不用路径和扩展名）
- `path=<path>` — vault 根目录起的精确路径，如 `folder/note.md`
- `vault=<name>` — 指定 vault（默认用最近聚焦的 vault）
- `--copy` — 复制输出到剪贴板
- `silent` — 防止文件被打开
- `overwrite` — 创建时覆盖已有文件
- `total` — 列表命令加上总数

---

## 笔记操作

```bash
obsidian read file="My Note"                                         # 读笔记
obsidian create name="New Note" content="# Hello" silent            # 创建笔记
obsidian create path="folder/note.md" content="..." silent overwrite # 精确路径创建/覆写
obsidian append file="My Note" content="新内容"                      # 追加内容
obsidian delete file="My Note"                                       # 删除笔记
```

## 搜索

```bash
obsidian search query="关键词" limit=10                              # 全文搜索
obsidian backlinks file="My Note"                                    # 查反向链接
obsidian tags sort=count counts                                      # 查所有 tags
```

## 日记

```bash
obsidian daily:read                                                  # 读今天日记
obsidian daily:append content="- [ ] New task"                      # 追加到今天日记
```

## 属性（Properties）

```bash
obsidian property:set name="status" value="done" file="My Note"     # 设置属性
obsidian property:get name="status" file="My Note"                  # 读取属性
```

## 任务

```bash
obsidian tasks daily todo                                            # 今天待办
obsidian tasks todo path="Projects/My Project.md"                   # 指定文件待办
obsidian tasks done                                                  # 已完成任务
```

## 模板

```bash
obsidian create name="New Note" template="Daily Note"               # 用模板创建
```
