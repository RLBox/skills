# 插件 & 主题开发调试

## 开发/测试循环

```bash
# 1. 重载插件
obsidian plugin:reload id=my-plugin

# 2. 检查错误
obsidian dev:errors

# 3. 截图验证
obsidian dev:screenshot path=screenshot.png
obsidian dev:dom selector=".workspace-leaf" text

# 4. 检查 console
obsidian dev:console level=error
```

## 其他开发命令

```bash
# 在 app 上下文执行 JS
obsidian eval code="app.vault.getFiles().length"

# 检查 CSS
obsidian dev:css selector=".workspace-leaf" prop=background-color

# 切换移动端模拟
obsidian dev:mobile on
obsidian dev:mobile off
```

## 插件目录结构

```
~/.clacky/skills/my-plugin/
├── main.ts          # 插件入口
├── manifest.json    # 插件元信息
├── styles.css       # 可选：自定义样式
└── README.md
```

## manifest.json 示例

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "description": "Plugin description",
  "author": "Author Name",
  "isDesktopOnly": false
}
```
