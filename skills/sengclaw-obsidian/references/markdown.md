# Obsidian Flavored Markdown

## 内部链接（Wikilinks）

```markdown
[[Note Name]]                     链接到笔记
[[Note Name|Display Text]]        自定义显示文字
[[Note Name#Heading]]             链接到标题
[[Note Name#^block-id]]           链接到块
[[#Heading in same note]]         同笔记内标题链接
```

## 嵌入

```markdown
![[Note Name]]                    嵌入完整笔记
![[Note Name#Heading]]            嵌入某节
![[image.png]]                    嵌入图片
![[image.png|300]]                嵌入图片（指定宽度）
![[document.pdf#page=3]]          嵌入 PDF 第3页
```

## Callout

```markdown
> [!note]
> 基本 callout。

> [!warning] 自定义标题
> 有自定义标题的 callout。

> [!faq]- 默认折叠
> 可折叠 callout（- 折叠，+ 展开）。
```

常用类型：`note` `tip` `warning` `info` `example` `quote` `bug` `danger` `success` `failure` `question` `abstract` `todo`

## Properties（Frontmatter）

```yaml
---
title: My Note
date: 2024-01-15
tags:
  - project
  - active
aliases:
  - Alternative Name
cssclasses:
  - custom-class
---
```

## Tags

```markdown
#tag                    行内 tag
#nested/tag             嵌套 tag
```

## 注释（隐藏文字）

```markdown
This is visible %%but this is hidden%% text.
```

## 块引用 ID

```markdown
This is a paragraph with a block ID. ^block-id

Elsewhere: [[Note#^block-id]]
```
