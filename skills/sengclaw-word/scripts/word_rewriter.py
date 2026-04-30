#!/usr/bin/env python3
"""
word_rewriter.py - Word/WPS 文档净改写工具

用法:
  python3 word_rewriter.py <input.docx> <rewrite.json> [output.docx]

rewrite.json 格式:
{
  "preserve": [
    "需要保留全称、不被替换的片段（精确字符串）"
  ],
  "replacements": [
    {
      "old": "要替换的旧文字",
      "new": "替换为的新文字",
      "node_prefix": true   // 可选，true 时同时处理拆分节点（>旧文字< 形式）
    }
  ],
  "injections": [
    {
      "anchor": "锚定文字（全文唯一，新段落插入在它前面）",
      "text": "要注入的新段落文字"
    }
  ],
  "forbidden": [
    "替换后不应出现的词（用于验证）"
  ]
}

所有字段均为可选，按需填写。
"""

import os
import sys
import json
import re
import shutil
import zipfile
import tempfile
from datetime import datetime


# ─── 打包工具 ─────────────────────────────────────────────────────────────────

def extract_docx(input_path, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    with zipfile.ZipFile(input_path, 'r') as z:
        z.extractall(work_dir)


def pack_docx(work_dir, output_path):
    """重新打包为 docx，[Content_Types].xml 排第一（兼容性要求）"""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        ct_path = os.path.join(work_dir, '[Content_Types].xml')
        if os.path.exists(ct_path):
            zf.write(ct_path, '[Content_Types].xml')
        for root, dirs, files in os.walk(work_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, work_dir)
                if arcname == '[Content_Types].xml':
                    continue
                zf.write(file_path, arcname)


# ─── 文本提取（供预览 / 验证用）─────────────────────────────────────────────

def extract_texts(content):
    """从 document.xml 内容中提取所有 <w:t> 节点的文字"""
    return re.findall(r'<w:t[^>]*>([^<]+)</w:t>', content)


def full_text(content):
    return ''.join(extract_texts(content))


# ─── 占位符保护 ───────────────────────────────────────────────────────────────

def apply_preserve(content, preserve_list):
    """
    把需要保留的片段替换为占位符，防止被后续 replacements 误伤。
    返回 (新 content, placeholders 字典)
    """
    placeholders = {}
    for i, text in enumerate(preserve_list):
        ph = f'__PRESERVE_{i}__'
        if text in content:
            placeholders[ph] = text
            content = content.replace(text, ph)
        else:
            print(f'[WARN] preserve 目标不存在，跳过: {text[:50]}', file=sys.stderr)
    return content, placeholders


def restore_preserve(content, placeholders):
    """还原占位符"""
    for ph, text in placeholders.items():
        content = content.replace(ph, text)
    return content


# ─── 批量替换 ─────────────────────────────────────────────────────────────────

def apply_replacements(content, replacements):
    """
    按顺序执行替换规则。
    node_prefix=true 时额外处理 >旧文字< 形式（拆分节点）。
    """
    count = 0
    for rule in replacements:
        old = rule.get('old', '')
        new = rule.get('new', '')
        node_prefix = rule.get('node_prefix', False)

        if not old:
            continue

        before = content
        content = content.replace(old, new)
        changed = content != before
        if changed:
            count += 1
            print(f'[OK] 替换: {old[:40]!r} → {new[:40]!r}')
        else:
            print(f'[WARN] 未找到替换目标: {old[:50]!r}', file=sys.stderr)

        # 拆分节点处理：处理 >旧文字< 形式（节点边界夹住的孤立片段）
        if node_prefix:
            node_old = f'>{old}<'
            node_new = f'>{new}<'
            before2 = content
            content = content.replace(node_old, node_new)
            if content != before2:
                print(f'[OK] 拆分节点替换: {node_old[:40]!r} → {node_new[:40]!r}')

    print(f'[INFO] 共完成 {count} 条替换')
    return content


# ─── 段落注入 ─────────────────────────────────────────────────────────────────

def apply_injections(content, injections):
    """
    在锚定文字所在节点前插入新段落。
    anchor 必须是 document.xml 中某个 <w:t> 节点的完整文字内容（全文唯一最佳）。

    注入结果：
      ... <w:t xml:space="preserve">新段落文字</w:t></w:r></w:p>
      <w:p><w:r><w:t>anchor 原文</w:t> ...
    """
    for item in injections:
        anchor = item.get('anchor', '').strip()
        text = item.get('text', '').strip()
        if not anchor or not text:
            continue

        # 尝试精确匹配 <w:t>anchor</w:t>
        target = f'<w:t>{anchor}</w:t>'
        if target not in content:
            # 也尝试带 xml:space 属性的形式
            target_alt = f'<w:t xml:space="preserve">{anchor}</w:t>'
            if target_alt in content:
                target = target_alt
            else:
                print(f'[WARN] 注入锚点未找到: {anchor[:50]!r}', file=sys.stderr)
                continue

        replacement = (
            f'<w:t xml:space="preserve">{text}</w:t>'
            f'</w:r></w:p><w:p><w:r>'
            f'{target}'
        )
        content = content.replace(target, replacement, 1)
        print(f'[OK] 注入段落（锚点: {anchor[:40]!r}）')

    return content


# ─── 重复词检测 ───────────────────────────────────────────────────────────────

def detect_duplicates(content, replacements):
    """
    自动检测替换后可能产生的重复词。
    对每条替换规则，检查 new+new（或 new 的最后一个词 + new 的第一个词）是否出现。
    """
    texts = extract_texts(content)
    warnings = []
    for rule in replacements:
        new = rule.get('new', '')
        if not new:
            continue
        # 检查完整重复
        doubled = new + new
        for t in texts:
            if doubled in t:
                warnings.append(f'[WARN] 疑似重复词: {t!r}')
        # 检查首尾拼接重复（拆分节点场景）
        # 例如 new="企业版" → 上一节点以"企业版"结尾，下一节点以"企业版"开头
        # 这里做简单的跨节点检测：连续两个节点拼接后含 doubled
        joined = ''.join(texts)
        if doubled in joined:
            # 精确定位哪个位置
            idx = joined.find(doubled)
            warnings.append(f'[WARN] 跨节点重复词 "{doubled}" 出现在文本位置 {idx}')
    return warnings


# ─── 危险词验证 ───────────────────────────────────────────────────────────────

def verify_forbidden(content, forbidden_list):
    """验证文档不含禁用词，返回 (passed, results)"""
    ft = full_text(content)
    results = []
    passed = True
    for word in forbidden_list:
        if word in ft:
            results.append(f'[FAIL] 仍含禁用词: {word!r}')
            passed = False
        else:
            results.append(f'[OK]   已清除: {word!r}')
    return passed, results


# ─── 文本预览 ─────────────────────────────────────────────────────────────────

def preview_texts(content, keyword=None):
    """打印所有 <w:t> 节点文字，可按关键词过滤"""
    texts = extract_texts(content)
    for t in texts:
        t = t.strip()
        if not t:
            continue
        if keyword is None or keyword in t:
            print(repr(t))


# ─── 主流程 ───────────────────────────────────────────────────────────────────

def rewrite(input_path, config, output_path):
    preserve_list  = config.get('preserve', [])
    replacements   = config.get('replacements', [])
    injections     = config.get('injections', [])
    forbidden_list = config.get('forbidden', [])

    # 1. 解压
    work_dir = tempfile.mkdtemp(prefix='word_rewriter_')
    try:
        extract_docx(input_path, work_dir)
        doc_path = os.path.join(work_dir, 'word', 'document.xml')

        with open(doc_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 2. 占位符保护
        if preserve_list:
            print(f'\n── 占位符保护（{len(preserve_list)} 条）──')
            content, placeholders = apply_preserve(content, preserve_list)
        else:
            placeholders = {}

        # 3. 批量替换
        if replacements:
            print(f'\n── 批量替换（{len(replacements)} 条规则）──')
            content = apply_replacements(content, replacements)

        # 4. 还原占位符
        if placeholders:
            content = restore_preserve(content, placeholders)
            print(f'[OK] 还原占位符 {len(placeholders)} 条')

        # 5. 段落注入
        if injections:
            print(f'\n── 段落注入（{len(injections)} 条）──')
            content = apply_injections(content, injections)

        # 6. 重复词检测
        if replacements:
            print(f'\n── 重复词检测 ──')
            dup_warnings = detect_duplicates(content, replacements)
            if dup_warnings:
                for w in dup_warnings:
                    print(w, file=sys.stderr)
                print('[提示] 发现疑似重复词，请确认是否需要手动修复后重新运行', file=sys.stderr)
            else:
                print('[OK] 未检测到重复词')

        # 7. 危险词验证
        if forbidden_list:
            print(f'\n── 危险词验证（{len(forbidden_list)} 个）──')
            passed, results = verify_forbidden(content, forbidden_list)
            for r in results:
                print(r)
            if not passed:
                print('[ERROR] 存在未清除的禁用词，请检查替换规则', file=sys.stderr)
                # 不中断，继续输出，让用户看到文件后决定

        # 8. 写回 + 打包
        with open(doc_path, 'w', encoding='utf-8') as f:
            f.write(content)

        pack_docx(work_dir, output_path)
        print(f'\n[DONE] 输出文件: {output_path}')

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ─── 入口 ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    input_path  = sys.argv[1]
    config_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.exists(input_path):
        print(f'[ERROR] 输入文件不存在: {input_path}', file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(config_path):
        print(f'[ERROR] 配置文件不存在: {config_path}', file=sys.stderr)
        sys.exit(1)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f'{base}_rewritten{ext}'

    rewrite(input_path, config, output_path)


if __name__ == '__main__':
    main()
