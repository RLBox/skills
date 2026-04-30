#!/usr/bin/env python3
"""
word_editor.py - Word/WPS 文档批注与修订编辑器

用法:
  python3 word_editor.py <input.docx> <instructions.json> [output.docx]

instructions.json 格式:
{
  "comments": [
    {
      "target_text": "要批注的段落中包含的文字",
      "comment": "批注内容"
    }
  ],
  "revisions": [
    {
      "old_text": "要删除的原文",
      "new_text": "替换为的新文字（留空则纯删除）"
    }
  ]
}
"""

import os
import sys
import json
import shutil
import zipfile
from datetime import datetime, timezone
from lxml import etree


# ─── 命名空间 ────────────────────────────────────────────────────────────────

NS = {
    'w':   'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
    'w15': 'http://schemas.microsoft.com/office/word/2012/wordml',
    'r':   'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'cp':  'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
    'dc':  'http://purl.org/dc/elements/1.1/',
}

COMMENTS_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"

W = NS['w']


def w(tag):
    return f'{{{W}}}{tag}'


# ─── 读取文档作者 ─────────────────────────────────────────────────────────────

def get_author(work_dir):
    """从 core.xml 读取文档作者，兼容 Word 和 WPS"""
    core_path = os.path.join(work_dir, 'docProps', 'core.xml')
    if not os.path.exists(core_path):
        return 'AI审核'
    tree = etree.parse(core_path)
    root = tree.getroot()
    creator = root.find(f'{{{NS["dc"]}}}creator')
    if creator is not None and creator.text:
        return creator.text.strip()
    # WPS 有时用 lastModifiedBy
    last = root.find(f'{{{NS["cp"]}}}lastModifiedBy')
    if last is not None and last.text:
        return last.text.strip()
    return 'AI审核'


# ─── 解压 / 打包 ──────────────────────────────────────────────────────────────

def extract_docx(input_path, work_dir):
    os.makedirs(work_dir, exist_ok=True)
    with zipfile.ZipFile(input_path, 'r') as z:
        z.extractall(work_dir)


def pack_docx(work_dir, output_path):
    """重新打包为 docx，确保 [Content_Types].xml 排第一（兼容性要求）"""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml 必须是第一个条目
        ct_path = os.path.join(work_dir, '[Content_Types].xml')
        if os.path.exists(ct_path):
            zf.write(ct_path, '[Content_Types].xml')
        for root, dirs, files in os.walk(work_dir):
            # 跳过隐藏目录
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, work_dir)
                if arcname == '[Content_Types].xml':
                    continue  # 已经写过了
                zf.write(file_path, arcname)


# ─── 批注功能 ─────────────────────────────────────────────────────────────────

def _load_or_create_comments(work_dir):
    """加载 comments.xml，不存在则创建"""
    comments_path = os.path.join(work_dir, 'word', 'comments.xml')
    if os.path.exists(comments_path):
        tree = etree.parse(comments_path)
        return tree, tree.getroot()
    # 新建
    root = etree.Element(w('comments'), nsmap={
        'w': W,
        'w14': NS['w14'],
        'w15': NS['w15'],
    })
    tree = etree.ElementTree(root)
    return tree, root


def _ensure_comments_relationship(work_dir):
    """确保 document.xml.rels 中有 comments.xml 的关系条目"""
    rels_path = os.path.join(work_dir, 'word', '_rels', 'document.xml.rels')
    if not os.path.exists(rels_path):
        return
    tree = etree.parse(rels_path)
    root = tree.getroot()

    # 检查是否已存在
    for rel in root:
        if rel.get('Type') == COMMENTS_REL_TYPE:
            return  # 已存在

    # 计算下一个 rId
    max_rid = 0
    for rel in root:
        rid = rel.get('Id', '')
        if rid.startswith('rId'):
            try:
                max_rid = max(max_rid, int(rid[3:]))
            except ValueError:
                pass
    new_rid = f'rId{max_rid + 1}'

    rel_elem = etree.SubElement(root, f'{{{NS["rel"]}}}Relationship')
    rel_elem.set('Id', new_rid)
    rel_elem.set('Type', COMMENTS_REL_TYPE)
    rel_elem.set('Target', 'comments.xml')

    tree.write(rels_path, xml_declaration=True, encoding='UTF-8', standalone=True)


def _ensure_comments_content_type(work_dir):
    """确保 [Content_Types].xml 包含 comments.xml 条目"""
    ct_path = os.path.join(work_dir, '[Content_Types].xml')
    if not os.path.exists(ct_path):
        return
    tree = etree.parse(ct_path)
    root = tree.getroot()
    ct_ns = 'http://schemas.openxmlformats.org/package/2006/content-types'
    COMMENTS_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml'

    for override in root.findall(f'{{{ct_ns}}}Override'):
        if override.get('PartName') == '/word/comments.xml':
            return  # 已存在

    override = etree.SubElement(root, f'{{{ct_ns}}}Override')
    override.set('PartName', '/word/comments.xml')
    override.set('ContentType', COMMENTS_CT)
    tree.write(ct_path, xml_declaration=True, encoding='UTF-8', standalone=True)


def _next_comment_id(comments_root):
    existing = [int(c.get(w('id'), -1)) for c in comments_root.findall(w('comment'))]
    return max(existing) + 1 if existing else 0


def _build_comment_element(comments_root, comment_id, author, text, date_str):
    """构建 <w:comment> 元素"""
    comment = etree.SubElement(comments_root, w('comment'))
    comment.set(w('id'), str(comment_id))
    comment.set(w('author'), author)
    comment.set(w('initials'), author[0] if author else 'A')
    comment.set(w('date'), date_str)

    para = etree.SubElement(comment, w('p'))
    # 批注引用标记
    run_ref = etree.SubElement(para, w('r'))
    rpr = etree.SubElement(run_ref, w('rPr'))
    style = etree.SubElement(rpr, w('rStyle'))
    style.set(w('val'), 'CommentReference')
    annotation = etree.SubElement(run_ref, w('annotationRef'))  # noqa

    # 批注文字
    run_text = etree.SubElement(para, w('r'))
    t = etree.SubElement(run_text, w('t'))
    t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return comment


def _insert_comment_marks_in_para(para, comment_id):
    """在段落首尾插入 commentRangeStart / End / commentReference"""
    id_str = str(comment_id)

    range_start = etree.Element(w('commentRangeStart'))
    range_start.set(w('id'), id_str)

    range_end = etree.Element(w('commentRangeEnd'))
    range_end.set(w('id'), id_str)

    ref_run = etree.Element(w('r'))
    rpr = etree.SubElement(ref_run, w('rPr'))
    style = etree.SubElement(rpr, w('rStyle'))
    style.set(w('val'), 'CommentReference')
    comment_ref = etree.SubElement(ref_run, w('commentReference'))
    comment_ref.set(w('id'), id_str)

    para.insert(0, range_start)
    para.append(range_end)
    para.append(ref_run)


def add_comments(work_dir, comments_list, author, date_str):
    """批量添加批注"""
    doc_path = os.path.join(work_dir, 'word', 'document.xml')
    doc_tree = etree.parse(doc_path)
    doc_root = doc_tree.getroot()

    comments_tree, comments_root = _load_or_create_comments(work_dir)
    _ensure_comments_relationship(work_dir)
    _ensure_comments_content_type(work_dir)

    added = 0
    for item in comments_list:
        target_text = item.get('target_text', '').strip()
        comment_text = item.get('comment', '').strip()
        if not target_text or not comment_text:
            continue

        # 查找目标段落
        found_para = None
        for para in doc_root.iter(w('p')):
            para_text = ''.join(t.text or '' for t in para.iter(w('t')))
            if target_text in para_text:
                found_para = para
                break

        if found_para is None:
            print(f'[WARN] 未找到段落文本: {target_text[:30]}...', file=sys.stderr)
            continue

        comment_id = _next_comment_id(comments_root)
        _build_comment_element(comments_root, comment_id, author, comment_text, date_str)
        _insert_comment_marks_in_para(found_para, comment_id)
        added += 1

    doc_tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    comments_path = os.path.join(work_dir, 'word', 'comments.xml')
    comments_tree.write(comments_path, xml_declaration=True, encoding='UTF-8', standalone=True)

    print(f'[OK] 添加批注: {added} 条')
    return added


# ─── 修订功能 ─────────────────────────────────────────────────────────────────

def _next_revision_id(doc_root):
    """扫描 document.xml 中已有的最大修订 ID"""
    max_id = 0
    for elem in doc_root.iter():
        rid = elem.get(w('id'))
        if rid is not None:
            try:
                max_id = max(max_id, int(rid))
            except ValueError:
                pass
    return max_id + 1


def _get_text_runs(para):
    """返回段落中所有 <w:r> 元素和其文字"""
    return [(r, ''.join(t.text or '' for t in r.iter(w('t')))) for r in para.findall(w('r'))]


def _para_full_text(para):
    return ''.join(t.text or '' for t in para.iter(w('t')))


def _split_run_at(run, offset):
    """
    将 <w:r> 在 offset 位置拆分为两个 run，返回 (before_run, after_run)。
    before_run 包含 [0:offset]，after_run 包含 [offset:]。
    """
    import copy
    text_elems = run.findall(w('t'))
    full_text = ''.join(t.text or '' for t in text_elems)

    before_text = full_text[:offset]
    after_text = full_text[offset:]

    before_run = copy.deepcopy(run)
    for t in before_run.findall(w('t')):
        before_run.remove(t)
    if before_text:
        t_elem = etree.SubElement(before_run, w('t'))
        t_elem.text = before_text
        t_elem.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

    after_run = copy.deepcopy(run)
    for t in after_run.findall(w('t')):
        after_run.remove(t)
    if after_text:
        t_elem = etree.SubElement(after_run, w('t'))
        t_elem.text = after_text
        t_elem.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')

    return before_run, after_run


def _make_ins_element(rev_id, author, date_str, new_text, rpr=None):
    """构建 <w:ins> 元素"""
    import copy
    ins = etree.Element(w('ins'))
    ins.set(w('id'), str(rev_id))
    ins.set(w('author'), author)
    ins.set(w('date'), date_str)

    run = etree.SubElement(ins, w('r'))
    if rpr is not None:
        run.append(copy.deepcopy(rpr))
    t = etree.SubElement(run, w('t'))
    t.text = new_text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return ins


def _make_del_element(rev_id, author, date_str, del_text, rpr=None):
    """构建 <w:del> 元素"""
    import copy
    del_elem = etree.Element(w('del'))
    del_elem.set(w('id'), str(rev_id))
    del_elem.set(w('author'), author)
    del_elem.set(w('date'), date_str)

    run = etree.SubElement(del_elem, w('r'))
    if rpr is not None:
        run.append(copy.deepcopy(rpr))
    dt = etree.SubElement(run, w('delText'))
    dt.text = del_text
    dt.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return del_elem


def _apply_revision_in_para(para, old_text, new_text, author, date_str, rev_id_start):
    """
    在段落内找到 old_text，用 <w:del>+<w:ins> 替换。
    返回消耗的 rev_id 数量。
    """
    import copy

    para_text = _para_full_text(para)
    pos = para_text.find(old_text)
    if pos < 0:
        return 0

    # 收集所有 run，记录每个 run 在段落全文中的起止偏移
    runs = list(para.findall(w('r')))
    run_ranges = []  # (run, start, end)
    cursor = 0
    for run in runs:
        run_text = ''.join(t.text or '' for t in run.iter(w('t')))
        run_ranges.append((run, cursor, cursor + len(run_text)))
        cursor += len(run_text)

    old_end = pos + len(old_text)
    rev_id = rev_id_start
    used = 0

    # 找出覆盖 [pos, old_end) 的 run 集合
    affected = [(run, rs, re) for (run, rs, re) in run_ranges if rs < old_end and re > pos]
    if not affected:
        return 0

    parent = para
    first_run, first_start, first_end = affected[0]
    last_run, last_start, last_end = affected[-1]
    first_idx = list(parent).index(first_run)

    # 在 first_run 之前获取 rPr（格式信息）
    first_rpr = first_run.find(w('rPr'))

    # 分段处理：
    # 1. first_run 中 pos 之前的部分 → 保留（不在删除范围内）
    # 2. 删除范围内的所有 run → <w:del>
    # 3. 插入新文字 → <w:ins>（如果 new_text 非空）
    # 4. last_run 中 old_end 之后的部分 → 保留

    insert_pos = first_idx  # 新元素从这里开始插入

    # --- 1. first_run 前半段（保留）---
    pre_offset = pos - first_start
    pre_run = None
    if pre_offset > 0:
        pre_run, _ = _split_run_at(first_run, pre_offset)

    # --- 4. last_run 后半段（保留）---
    post_offset = old_end - last_start
    post_run = None
    if post_offset < (last_end - last_start):
        _, post_run = _split_run_at(last_run, post_offset)

    # --- 删除所有涉及的原始 run ---
    for run, _, _ in affected:
        parent.remove(run)

    # --- 拼接删除文字 ---
    del_text_parts = []
    for run, rs, re in affected:
        rtext = ''.join(t.text or '' for t in run.iter(w('t')))
        # 裁剪到 [pos, old_end) 范围
        clip_start = max(pos, rs) - rs
        clip_end = min(old_end, re) - rs
        del_text_parts.append(rtext[clip_start:clip_end])
    del_text_full = ''.join(del_text_parts)

    # --- 插入元素（按顺序）---
    idx = insert_pos
    if pre_run is not None:
        parent.insert(idx, pre_run)
        idx += 1

    del_elem = _make_del_element(rev_id, author, date_str, del_text_full, first_rpr)
    parent.insert(idx, del_elem)
    idx += 1
    rev_id += 1
    used += 1

    if new_text:
        ins_elem = _make_ins_element(rev_id, author, date_str, new_text, first_rpr)
        parent.insert(idx, ins_elem)
        idx += 1
        rev_id += 1
        used += 1

    if post_run is not None:
        parent.insert(idx, post_run)

    return used


def add_revisions(work_dir, revisions_list, author, date_str):
    """批量添加修订"""
    doc_path = os.path.join(work_dir, 'word', 'document.xml')
    doc_tree = etree.parse(doc_path)
    doc_root = doc_tree.getroot()

    rev_id = _next_revision_id(doc_root)
    added = 0

    for item in revisions_list:
        old_text = item.get('old_text', '').strip()
        new_text = item.get('new_text', '').strip()  # 空字符串 = 纯删除
        if not old_text:
            continue

        for para in doc_root.iter(w('p')):
            para_text = _para_full_text(para)
            if old_text in para_text:
                used = _apply_revision_in_para(para, old_text, new_text, author, date_str, rev_id)
                if used > 0:
                    rev_id += used
                    added += 1
                    break  # 只修改首次匹配

        else:
            print(f'[WARN] 未找到修订目标文本: {old_text[:30]}...', file=sys.stderr)

    # 确保 settings.xml 中启用修订跟踪（可选，增强兼容性）
    _enable_track_changes(work_dir)

    doc_tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)
    print(f'[OK] 添加修订: {added} 条')
    return added


def _enable_track_changes(work_dir):
    """在 settings.xml 中启用 trackRevisions（可选）"""
    settings_path = os.path.join(work_dir, 'word', 'settings.xml')
    if not os.path.exists(settings_path):
        return
    tree = etree.parse(settings_path)
    root = tree.getroot()
    # 检查是否已存在
    existing = root.find(w('trackRevisions'))
    if existing is None:
        tr = etree.SubElement(root, w('trackRevisions'))
        tr.set(w('val'), '1')
        tree.write(settings_path, xml_declaration=True, encoding='UTF-8', standalone=True)


# ─── 主入口 ───────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    input_path = sys.argv[1]
    instructions_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.exists(input_path):
        print(f'[ERROR] 输入文件不存在: {input_path}', file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(instructions_path):
        print(f'[ERROR] 指令文件不存在: {instructions_path}', file=sys.stderr)
        sys.exit(1)

    with open(instructions_path, 'r', encoding='utf-8') as f:
        instructions = json.load(f)

    # 默认输出路径
    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f'{base}_reviewed{ext}'

    # 解压
    work_dir = f'/tmp/word_editor_{datetime.now().strftime("%Y%m%d%H%M%S")}'
    extract_docx(input_path, work_dir)

    # 读取作者
    author = get_author(work_dir)
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    print(f'[INFO] 文档作者: {author}')

    # 执行批注
    comments_list = instructions.get('comments', [])
    if comments_list:
        add_comments(work_dir, comments_list, author, date_str)

    # 执行修订
    revisions_list = instructions.get('revisions', [])
    if revisions_list:
        add_revisions(work_dir, revisions_list, author, date_str)

    # 打包输出
    pack_docx(work_dir, output_path)
    shutil.rmtree(work_dir)

    print(f'[DONE] 输出文件: {output_path}')


if __name__ == '__main__':
    main()
