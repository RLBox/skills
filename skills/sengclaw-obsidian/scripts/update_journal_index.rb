#!/usr/bin/env ruby
# sengclaw-obsidian-journal/scripts/update_journal_index.rb
# 提炼今日日记要点，幂等地更新 ~/.clacky/memories/daily-journal-index.md
#
# 使用方式：
#   ruby update_journal_index.rb                    # 更新今天
#   ruby update_journal_index.rb 2026-03-28         # 更新指定日期
#   ruby update_journal_index.rb --points "要点1|要点2|要点3"  # 直接传入要点（跳过读文件）

require 'date'
require 'fileutils'

# === 配置 ===
VAULT_MEMORY_DIR = File.expand_path("~/clacky_workspace/memory")
JOURNAL_INDEX    = File.expand_path("~/.clacky/memories/daily-journal-index.md")

# === 参数解析 ===
date_str   = nil
points_arg = nil

ARGV.each_with_index do |arg, i|
  if arg == '--points'
    points_arg = ARGV[i + 1]
  elsif arg =~ /^\d{4}-\d{2}-\d{2}$/
    date_str = arg
  end
end

date     = date_str ? Date.parse(date_str) : Date.today
date_key = date.strftime("%Y-%m-%d")

# === 读取日记原文 ===
diary_path = File.join(VAULT_MEMORY_DIR, "#{date_key}.md")
unless File.exist?(diary_path)
  warn "日记文件不存在: #{diary_path}"
  exit 1
end

diary_content = File.read(diary_path)

# === 读取或初始化索引文件 ===
unless File.exist?(JOURNAL_INDEX)
  FileUtils.mkdir_p(File.dirname(JOURNAL_INDEX))
  File.write(JOURNAL_INDEX, <<~HEADER)
    ---
    topic: daily-journal-index
    description: 张润胜每日日记的完整索引，记录每天的状态、项目进展、关键决策和重要事件。日记原文路径：/Users/zhangrunsheng/clacky_workspace/memory/YYYY-MM-DD.md
    updated_at: #{date_key}
    ---

    # 每日日记索引

    日记原文目录：`/Users/zhangrunsheng/clacky_workspace/memory/`

    如需了解某天详情，用 file_reader 读取对应日期文件。

    ---

  HEADER
end

index_content = File.read(JOURNAL_INDEX)

# === 幂等检查：已有今天条目则退出 ===
if index_content.include?("## #{date_key}")
  puts "已存在 #{date_key} 条目，跳过"
  exit 0
end

# === 生成要点 ===
if points_arg
  # 直接传入要点
  points = points_arg.split("|").map(&:strip).first(5)
else
  # 从日记内容自动提炼（简单规则：取标题行和 ✅ 行）
  lines = diary_content.lines.map(&:strip).reject(&:empty?)
  
  candidates = lines.select do |l|
    l.match?(/^#{Regexp.escape("✅")}|^-\s.*完成|^-\s.*确认|^-\s.*决定|关键|洞察|反馈|合同|打款|发布|拒绝|合作/)
  end
  
  # fallback: 取前几个非标题的有意义行
  if candidates.length < 2
    candidates = lines.reject { |l| l.start_with?("#") || l.length < 10 }.first(5)
  end
  
  # 清洗 markdown 符号，截断到 30 字
  points = candidates.first(5).map do |l|
    cleaned = l.gsub(/^[-*#]+\s+/, "")
               .gsub(/\*\*([^*]+)\*\*/, '')
               .gsub(/`([^`]+)`/, '')
               .gsub(/\[([^\]]+)\]\([^\)]+\)/, '')
               .gsub(/【[^】]*】/, "")
               .strip
    # 若内容超 30 字且有冒号，取冒号前部分
    if cleaned.length > 30 && cleaned.include?("：")
      cleaned = cleaned.split("：").first.strip
    end
    cleaned.slice(0, 30)
  end.reject(&:empty?)
end

if points.empty?
  warn "无法提炼要点，请手动更新索引"
  exit 1
end

# === 追加到索引 ===
entry = "\n## #{date_key}\n" + points.map { |p| "- #{p}" }.join("\n") + "\n"

# 更新 updated_at
new_content = index_content.gsub(/updated_at:.*/, "updated_at: #{date_key}")
new_content += entry

File.write(JOURNAL_INDEX, new_content)
puts "✅ 已更新索引：#{date_key}"
points.each { |p| puts "  - #{p}" }
