import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { launchChrome, tryConnectExisting, findExistingChromeDebugPort, getPageSession, waitForNewTab, clickElement, typeText, evaluate, sleep, getAccountProfileDir, type ChromeSession, type CdpConnection } from './cdp.ts';
import { loadWechatExtendConfig, resolveAccount } from './wechat-extend-config.ts';

const WECHAT_URL = 'https://mp.weixin.qq.com/';

interface ImageInfo {
  placeholder: string;
  localPath: string;
  originalPath: string;
}

interface ArticleOptions {
  title: string;
  content?: string;
  htmlFile?: string;
  markdownFile?: string;
  theme?: string;
  color?: string;
  citeStatus?: boolean;
  author?: string;
  summary?: string;
  images?: string[];
  contentImages?: ImageInfo[];
  cover?: string;
  preview?: boolean;
  previewWxname?: string;  // 预览发送的微信号/QQ号/手机号
  submit?: boolean;
  profileDir?: string;
  cdpPort?: number;
}

async function waitForLogin(session: ChromeSession, timeoutMs = 120_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = await evaluate<string>(session, 'window.location.href');
    if (url.includes('/cgi-bin/home')) return true;
    await sleep(2000);
  }
  return false;
}

async function waitForElement(session: ChromeSession, selector: string, timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await evaluate<boolean>(session, `!!document.querySelector('${selector}')`);
    if (found) return true;
    await sleep(500);
  }
  return false;
}

async function clickMenuByText(session: ChromeSession, text: string, maxRetries = 5): Promise<void> {
  console.log(`[wechat] Clicking "${text}" menu...`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const posResult = await session.cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: `
        (function() {
          const items = document.querySelectorAll('.new-creation__menu .new-creation__menu-item');
          for (const item of items) {
            const title = item.querySelector('.new-creation__menu-title');
            if (title && title.textContent?.trim() === '${text}') {
              item.scrollIntoView({ block: 'center' });
              const rect = item.getBoundingClientRect();
              return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
            }
          }
          return 'null';
        })()
      `,
      returnByValue: true,
    }, { sessionId: session.sessionId });

    if (posResult.result.value !== 'null') {
      const pos = JSON.parse(posResult.result.value);
      await session.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, { sessionId: session.sessionId });
      await sleep(100);
      await session.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, { sessionId: session.sessionId });
      return;
    }

    if (attempt < maxRetries) {
      const delay = Math.min(1000 * attempt, 3000);
      console.log(`[wechat] Menu "${text}" not found, retrying in ${delay}ms (${attempt}/${maxRetries})...`);
      await sleep(delay);
    }
  }
  throw new Error(`Menu "${text}" not found after ${maxRetries} attempts`);
}

async function copyImageToClipboard(imagePath: string): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const copyScript = path.join(__dirname, './copy-to-clipboard.ts');
  const result = spawnSync('npx', ['-y', 'bun', copyScript, 'image', imagePath], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to copy image: ${imagePath}`);
}

async function pasteInEditor(session: ChromeSession): Promise<void> {
  const modifiers = process.platform === 'darwin' ? 4 : 2;
  await session.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV', modifiers, windowsVirtualKeyCode: 86 }, { sessionId: session.sessionId });
  await sleep(50);
  await session.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', modifiers, windowsVirtualKeyCode: 86 }, { sessionId: session.sessionId });
}

async function sendCopy(cdp?: CdpConnection, sessionId?: string): Promise<void> {
  if (process.platform === 'darwin') {
    spawnSync('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down']);
  } else if (process.platform === 'linux') {
    spawnSync('xdotool', ['key', 'ctrl+c']);
  } else if (cdp && sessionId) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'c', code: 'KeyC', modifiers: 2, windowsVirtualKeyCode: 67 }, { sessionId });
    await sleep(50);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'c', code: 'KeyC', modifiers: 2, windowsVirtualKeyCode: 67 }, { sessionId });
  }
}

async function sendPaste(cdp?: CdpConnection, sessionId?: string): Promise<void> {
  if (process.platform === 'darwin') {
    spawnSync('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
  } else if (process.platform === 'linux') {
    spawnSync('xdotool', ['key', 'ctrl+v']);
  } else if (cdp && sessionId) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV', modifiers: 2, windowsVirtualKeyCode: 86 }, { sessionId });
    await sleep(50);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', modifiers: 2, windowsVirtualKeyCode: 86 }, { sessionId });
  }
}

async function copyHtmlFromBrowser(cdp: CdpConnection, htmlFilePath: string, contentImages: ImageInfo[] = []): Promise<void> {
  const absolutePath = path.isAbsolute(htmlFilePath) ? htmlFilePath : path.resolve(process.cwd(), htmlFilePath);
  const fileUrl = `file://${absolutePath}`;

  console.log(`[wechat] Opening HTML file in new tab: ${fileUrl}`);

  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: fileUrl });
  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, { sessionId });
  await cdp.send('Runtime.enable', {}, { sessionId });
  await sleep(2000);

  if (contentImages.length > 0) {
    console.log('[wechat] Replacing img tags with placeholders for browser paste...');
    const replacements = contentImages.map(img => ({ placeholder: img.placeholder, localPath: img.localPath }));
    await cdp.send<{ result: { value: unknown } }>('Runtime.evaluate', {
      expression: `
        (function() {
          const replacements = ${JSON.stringify(replacements)};
          for (const r of replacements) {
            const imgs = document.querySelectorAll('img[src="' + r.placeholder + '"], img[data-local-path="' + r.localPath + '"]');
            for (const img of imgs) {
              const text = document.createTextNode(r.placeholder);
              img.parentNode.replaceChild(text, img);
            }
          }
          return true;
        })()
      `,
      returnByValue: true,
    }, { sessionId });
    await sleep(500);
  }

  console.log('[wechat] Selecting #output content...');
  await cdp.send<{ result: { value: unknown } }>('Runtime.evaluate', {
    expression: `
      (function() {
        const output = document.querySelector('#output') || document.body;
        const range = document.createRange();
        range.selectNodeContents(output);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      })()
    `,
    returnByValue: true,
  }, { sessionId });
  await sleep(300);

  console.log('[wechat] Copying content...');
  await sendCopy(cdp, sessionId);
  await sleep(1000);

  console.log('[wechat] Closing HTML tab...');
  await cdp.send('Target.closeTarget', { targetId });
}

async function pasteFromClipboardInEditor(session: ChromeSession): Promise<void> {
  console.log('[wechat] Pasting content...');
  await sendPaste(session.cdp, session.sessionId);
  await sleep(1000);
}

async function parseMarkdownWithPlaceholders(
  markdownPath: string,
  theme?: string,
  color?: string,
  citeStatus: boolean = true
): Promise<{ title: string; author: string; summary: string; htmlPath: string; contentImages: ImageInfo[] }> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const mdToWechatScript = path.join(__dirname, 'md-to-wechat.ts');
  const args = ['-y', 'bun', mdToWechatScript, markdownPath];
  if (theme) args.push('--theme', theme);
  if (color) args.push('--color', color);
  if (!citeStatus) args.push('--no-cite');

  const result = spawnSync('npx', args, { stdio: ['inherit', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || '';
    throw new Error(`Failed to parse markdown: ${stderr}`);
  }

  const output = result.stdout.toString();
  return JSON.parse(output);
}

function parseHtmlMeta(htmlPath: string): { title: string; author: string; summary: string; contentImages: ImageInfo[] } {
  const content = fs.readFileSync(htmlPath, 'utf-8');

  let title = '';
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1]!;

  let author = '';
  const authorMatch = content.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i)
    || content.match(/<meta\s+content=["']([^"']+)["']\s+name=["']author["']/i);
  if (authorMatch) author = authorMatch[1]!;

  let summary = '';
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || content.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) summary = descMatch[1]!;

  if (!summary) {
    const firstPMatch = content.match(/<p[^>]*>([^<]+)<\/p>/i);
    if (firstPMatch) {
      const text = firstPMatch[1]!.replace(/<[^>]+>/g, '').trim();
      if (text.length > 20) {
        summary = text.length > 120 ? text.slice(0, 117) + '...' : text;
      }
    }
  }

  const mdPath = htmlPath.replace(/\.html$/i, '.md');
  if (fs.existsSync(mdPath)) {
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const fmMatch = mdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const lines = fmMatch[1]!.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let value = line.slice(colonIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (key === 'title' && !title) title = value;
          if (key === 'author' && !author) author = value;
          if ((key === 'description' || key === 'summary') && !summary) summary = value;
        }
      }
    }
  }

  const contentImages: ImageInfo[] = [];
  const imgRegex = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  const matches = [...content.matchAll(imgRegex)];
  for (const match of matches) {
    const [fullTag, src] = match;
    if (!src || src.startsWith('http')) continue;
    const localPathMatch = fullTag.match(/data-local-path=["']([^"']+)["']/);
    if (localPathMatch) {
      contentImages.push({
        placeholder: src,
        localPath: localPathMatch[1]!,
        originalPath: src,
      });
    }
  }

  return { title, author, summary, contentImages };
}

async function selectAndReplacePlaceholder(session: ChromeSession, placeholder: string): Promise<boolean> {
  const result = await session.cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
    expression: `
      (function() {
        const editor = document.querySelector('.ProseMirror');
        if (!editor) return false;

        const placeholder = ${JSON.stringify(placeholder)};
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while ((node = walker.nextNode())) {
          const text = node.textContent || '';
          let searchStart = 0;
          let idx;
          // Search for exact match (not prefix of longer placeholder like XIMGPH_1 in XIMGPH_10)
          while ((idx = text.indexOf(placeholder, searchStart)) !== -1) {
            const afterIdx = idx + placeholder.length;
            const charAfter = text[afterIdx];
            // Exact match if next char is not a digit
            if (charAfter === undefined || !/\\d/.test(charAfter)) {
              node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

              const range = document.createRange();
              range.setStart(node, idx);
              range.setEnd(node, idx + placeholder.length);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              return true;
            }
            searchStart = afterIdx;
          }
        }
        return false;
      })()
    `,
    returnByValue: true,
  }, { sessionId: session.sessionId });

  return result.result.value;
}

async function pressDeleteKey(session: ChromeSession): Promise<void> {
  await session.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, { sessionId: session.sessionId });
  await sleep(50);
  await session.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, { sessionId: session.sessionId });
}

async function removeExtraEmptyLineAfterImage(session: ChromeSession): Promise<boolean> {
  const removed = await evaluate<boolean>(session, `
    (function() {
      const editor = document.querySelector('.ProseMirror');
      if (!editor) return false;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;

      let node = sel.anchorNode;
      if (!node) return false;
      let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!element || !editor.contains(element)) return false;

      const isEmptyParagraph = (el) => {
        if (!el || el.tagName !== 'P') return false;
        const text = (el.textContent || '').trim();
        if (text.length > 0) return false;
        return el.querySelectorAll('img, figure, video, iframe').length === 0;
      };

      const hasImage = (el) => {
        if (!el) return false;
        return !!el.querySelector('img, figure img, picture img');
      };

      const placeCursorAfter = (el) => {
        if (!el) return;
        const range = document.createRange();
        range.setStartAfter(el);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      };

      // Case 1: caret is inside an empty paragraph right after an image block.
      const emptyPara = element.closest('p');
      if (emptyPara && editor.contains(emptyPara) && isEmptyParagraph(emptyPara)) {
        const prev = emptyPara.previousElementSibling;
        if (prev && hasImage(prev)) {
          emptyPara.remove();
          placeCursorAfter(prev);
          return true;
        }
      }

      // Case 2: caret is on the image block itself; remove the next empty paragraph.
      const imageBlock = element.closest('figure, p');
      if (imageBlock && editor.contains(imageBlock) && hasImage(imageBlock)) {
        const next = imageBlock.nextElementSibling;
        if (next && isEmptyParagraph(next)) {
          next.remove();
          placeCursorAfter(imageBlock);
          return true;
        }
      }

      return false;
    })()
  `);

  if (removed) console.log('[wechat] Removed extra empty line after image.');
  return removed;
}

// Upload cover image to WeChat article editor
// Select cover image from the article body (「从正文选择封面」)
// Verified flow (2026-03-31):
//   Step 1: click .js_selectCoverFromContent → image picker dialog opens
//   Step 2: click_at image (JS .click() is ineffective, must use mouse coords)
//   Step 3: click .weui-desktop-dialog_img-picker .weui-desktop-btn_primary (「下一步」)
//   Step 4: click 「确认」 in crop dialog (.cover-edit-new → .weui-desktop-dialog)
// Returns true if cover was set successfully.
async function selectCoverFromContent(session: ChromeSession, cdp: CdpConnection): Promise<boolean> {
  console.log('[wechat] Setting cover from article content...');

  // Check if there are any images in the article body first
  const hasImages = await evaluate<boolean>(session, `
    !!(document.querySelector('.appmsg_content_img') || document.querySelector('.ProseMirror img'))
  `);
  if (!hasImages) {
    console.log('[wechat] No images found in article body, skipping cover selection.');
    return false;
  }

  // Step 1: Click the cover area to trigger the cover options menu
  // First click the cover btn area to show options (including「从正文选择」)
  const coverBtnClicked = await evaluate<boolean>(session, `
    (function() {
      var btn = document.querySelector('.js_cover_btn_area') ||
                document.querySelector('#js_cover_area .select-cover__btn') ||
                document.querySelector('#js_cover_area .select-cover__mask');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);

  if (!coverBtnClicked) {
    console.log('[wechat] Could not click cover btn area, trying direct .js_selectCoverFromContent...');
  } else {
    await sleep(800);
  }

  // Step 1b: Click「从正文选择」button
  const menuClicked = await evaluate<boolean>(session, `
    (function() {
      var btn = document.querySelector('.js_selectCoverFromContent');
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);

  if (!menuClicked) {
    console.warn('[wechat] Could not find .js_selectCoverFromContent button, skipping cover.');
    return false;
  }

  console.log('[wechat] Clicked 「从正文选择」, waiting for image picker dialog...');
  await sleep(2000);

  // Wait for image picker dialog to appear
  const pickerAppeared = await evaluate<boolean>(session, `
    !!(document.querySelector('.weui-desktop-dialog_img-picker') ||
       document.querySelector('.appmsg_content_img_list'))
  `);
  if (!pickerAppeared) {
    console.warn('[wechat] Image picker dialog did not appear after 2s, skipping cover.');
    return false;
  }

  // Step 2: Get the first image's coordinates and click it via mouse events
  // (JS .click() is NOT effective on these image items — must use real mouse coords)
  const imgCoords = await evaluate<{ x: number; y: number } | null>(session, `
    (function() {
      var img = document.querySelector('.appmsg_content_img.cover') ||
                document.querySelector('.appmsg_content_img_item img') ||
                document.querySelector('.appmsg_content_img_list img');
      if (!img) return null;
      var rect = img.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })()
  `);

  if (!imgCoords) {
    console.warn('[wechat] No image found in picker dialog, skipping cover.');
    return false;
  }

  console.log(`[wechat] Clicking image at coords (${imgCoords.x}, ${imgCoords.y})...`);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: imgCoords.x, y: imgCoords.y, button: 'left', clickCount: 1
  }, { sessionId: session.sessionId });
  await sleep(100);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: imgCoords.x, y: imgCoords.y, button: 'left', clickCount: 1
  }, { sessionId: session.sessionId });
  await sleep(1000);

  // Verify image was selected
  const isSelected = await evaluate<boolean>(session, `
    !!(document.querySelector('.appmsg_content_img_item.selected') ||
       document.querySelector('.appmsg_content_img_list .selected'))
  `);
  if (isSelected) {
    console.log('[wechat] Image selected in picker.');
  } else {
    console.log('[wechat] Image selection unclear, proceeding anyway...');
  }

  // Step 3: Click「下一步」button (only enabled after selecting an image)
  const nextClicked = await evaluate<boolean>(session, `
    (function() {
      var btn = document.querySelector('.weui-desktop-dialog_img-picker .weui-desktop-btn_primary');
      if (btn) {
        btn.click();
        return true;
      }
      // Fallback: find any primary btn in the picker dialog
      var allPrimary = document.querySelectorAll('.weui-desktop-btn_primary');
      for (var i = 0; i < allPrimary.length; i++) {
        var t = allPrimary[i].textContent.trim();
        if (t === '下一步' || t === '确定') {
          allPrimary[i].click();
          return true;
        }
      }
      return false;
    })()
  `);

  if (!nextClicked) {
    console.warn('[wechat] Could not find 「下一步」button in image picker, skipping cover.');
    return false;
  }

  console.log('[wechat] Clicked 「下一步」, waiting for crop dialog...');
  await sleep(2000);

  // Step 4: Click「确认」in the crop dialog (contains .cover-edit-new)
  const confirmClicked = await evaluate<boolean>(session, `
    (function() {
      var coverEdit = document.querySelector('.cover-edit-new');
      if (!coverEdit) return false;
      var dialog = coverEdit.closest('.weui-desktop-dialog');
      if (!dialog) return false;
      var btns = dialog.querySelectorAll('.weui-desktop-btn_primary');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === '确认') {
          btns[i].click();
          return true;
        }
      }
      // Fallback: click any primary btn in crop dialog
      if (btns.length > 0) { btns[0].click(); return true; }
      return false;
    })()
  `);

  if (!confirmClicked) {
    console.warn('[wechat] Could not find 「确认」button in crop dialog, skipping cover.');
    return false;
  }

  console.log('[wechat] Clicked 「确认」in crop dialog, waiting for cover to be set...');
  await sleep(2000);

  // Verify cover was set successfully
  const coverSet = await evaluate<boolean>(session, `
    (function() {
      var preview = document.querySelector('.js_cover_preview_new');
      if (!preview) return false;
      var s = window.getComputedStyle(preview);
      var bg = preview.style.backgroundImage || s.backgroundImage;
      return s.display !== 'none' && bg && bg !== 'none' && bg !== '';
    })()
  `);

  if (coverSet) {
    console.log('[wechat] ✅ Cover set successfully from article content!');
  } else {
    console.log('[wechat] Cover set status unclear, continuing...');
  }

  return coverSet;
}

// Dump all top-level toolbar/action buttons for debugging
async function dumpPreviewContext(session: ChromeSession): Promise<void> {
  const info = await evaluate<string>(session, `JSON.stringify((function() {
    // Find #js_preview
    var el = document.querySelector('#js_preview');
    var previewEl = el ? {
      found: true, tagName: el.tagName, id: el.id,
      className: el.className.slice(0, 60),
      innerText: el.innerText ? el.innerText.trim() : '',
      pointerEvents: window.getComputedStyle(el).pointerEvents,
      display: window.getComputedStyle(el).display,
      parentId: el.parentElement ? el.parentElement.id : null,
      parentClass: el.parentElement ? el.parentElement.className.slice(0,60) : null,
    } : { found: false };

    // Find all visible elements with text "预览"
    var allEls = document.querySelectorAll('*');
    var previewTexts = [];
    for (var i = 0; i < allEls.length; i++) {
      var e = allEls[i];
      if (!e.children.length && e.innerText && e.innerText.trim() === '预览') {
        previewTexts.push({ tag: e.tagName, id: e.id, cls: e.className.slice(0,50) });
      }
    }
    return { previewEl: previewEl, previewTexts: previewTexts };
  })())`);
  console.log('[wechat] Preview DOM context:', info);
}

// Click the preview button → fill wxname → confirm
// Dialog structure (verified via DOM inspection):
//   .wechat_send_dialog              — outer wrapper
//     .dialog_hd h3                  — "发送预览"
//     .dialog_bd
//       .wechat_send_content.preview_dialog
//         #js_preview_wxname         — input (press Enter to add tag)
//         .js_account .inner_tag__name — added tags
//         .js_del_account            — delete tag
//     .dialog_ft
//       .btn_primary .js_btn[data-index="0"]  — "确定"
//       .btn_default .js_btn[data-index="1"]  — "取消"
// Returns true if preview was sent successfully, false otherwise
async function clickPreview(session: ChromeSession, cdp: CdpConnection, previewWxname?: string): Promise<boolean> {
  console.log('[wechat] Looking for preview button #js_preview...');

  // Click #js_preview SPAN button
  const clicked = await evaluate<boolean>(session, `
    (function() {
      var el = document.querySelector('#js_preview');
      if (el) { el.click(); return true; }
      // Fallback: any visible span/button with exact text "预览"
      var all = document.querySelectorAll('span, button');
      for (var i = 0; i < all.length; i++) {
        var txt = (all[i].innerText || '').trim();
        var s = window.getComputedStyle(all[i]);
        if (txt === '预览' && s.display !== 'none') { all[i].click(); return true; }
      }
      return false;
    })()
  `);

  if (!clicked) {
    console.warn('[wechat] Preview button (#js_preview) not found.');
    return false;
  }

  console.log('[wechat] Preview button clicked. Waiting for .wechat_send_dialog...');

  // Wait up to 8s for the "发送预览" dialog to appear
  let dialogFound = false;
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    dialogFound = await evaluate<boolean>(session, `(function() {
      var d = document.querySelector('.wechat_send_dialog');
      if (!d) return false;
      var s = window.getComputedStyle(d);
      return s.display !== 'none' && s.visibility !== 'hidden';
    })()`);
    if (dialogFound) {
      console.log(`[wechat] ✅ 发送预览 dialog appeared after ${i + 1}s`);
      break;
    }
  }

  if (!dialogFound) {
    console.warn('[wechat] 发送预览 dialog did not appear after 8s.');
    return false;
  }

  // If previewWxname provided: type it into #js_preview_wxname and press Enter
  if (previewWxname) {
    console.log(`[wechat] Typing preview wxname: ${previewWxname}`);

    // Clear existing tags first
    await evaluate<void>(session, `(function() {
      var dels = document.querySelectorAll('.js_del_account');
      for (var i = dels.length - 1; i >= 0; i--) dels[i].click();
    })()`);
    await sleep(300);

    // Focus the input
    await evaluate<void>(session, `document.querySelector('#js_preview_wxname').focus()`);
    await sleep(200);

    // Type the wxname character by character via input event
    await evaluate<void>(session, `(function(val) {
      var input = document.querySelector('#js_preview_wxname');
      if (!input) return;
      input.value = val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })(${JSON.stringify(previewWxname)})`);
    await sleep(500);

    // Press Enter to confirm the tag
    await evaluate<void>(session, `(function() {
      var input = document.querySelector('#js_preview_wxname');
      if (!input) return;
      var e = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
      input.dispatchEvent(e);
      var e2 = new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true });
      input.dispatchEvent(e2);
    })()`);
    await sleep(800);

    // Verify tag was added
    const tagAdded = await evaluate<string>(session, `(function() {
      var tags = document.querySelectorAll('.js_account .inner_tag__name');
      var names = [];
      for (var i = 0; i < tags.length; i++) names.push(tags[i].innerText.trim());
      return names.join(',');
    })()`);
    console.log(`[wechat] Tags in preview dialog: "${tagAdded}"`);
  } else {
    // Check if there are already tags from before
    const existingTags = await evaluate<string>(session, `(function() {
      var tags = document.querySelectorAll('.js_account .inner_tag__name');
      var names = [];
      for (var i = 0; i < tags.length; i++) names.push(tags[i].innerText.trim());
      return names.join(',');
    })()`);
    console.log(`[wechat] Existing preview tags: "${existingTags}"`);
    if (!existingTags) {
      console.warn('[wechat] No preview wxname provided and no existing tags. Preview may fail.');
    }
  }

  // Click "确定" button
  console.log('[wechat] Clicking 确定 button...');
  const confirmed = await evaluate<boolean>(session, `(function() {
    // .dialog_ft .btn_primary button, or button[data-index="0"] in .dialog_ft
    var btn = document.querySelector('.wechat_send_dialog .dialog_ft .btn_primary .js_btn')
           || document.querySelector('.wechat_send_dialog .dialog_ft button[data-index="0"]')
           || document.querySelector('.wechat_send_dialog .dialog_ft .btn_primary');
    if (btn) { btn.click(); return true; }
    return false;
  })()`);

  if (!confirmed) {
    console.warn('[wechat] Could not find 确定 button in dialog.');
    return false;
  }

  // Wait a moment and check for success / error
  await sleep(2000);

  // Check for error message (e.g., "请确认该微信号是否关注此账号")
  const errorMsg = await evaluate<string>(session, `(function() {
    var warn = document.querySelector('.wechat_send_dialog .jsAccountFail');
    if (warn && window.getComputedStyle(warn).display !== 'none') return warn.innerText.trim();
    var warn2 = document.querySelector('.wechat_send_dialog .jsFailWithoutAddAccount');
    if (warn2 && window.getComputedStyle(warn2).display !== 'none') return '请确认该微信号是否关注此账号';
    return '';
  })()`);

  if (errorMsg) {
    console.warn(`[wechat] Preview error: ${errorMsg}`);
    // Still return true — dialog appeared, user may handle error manually
    return true;
  }

  // Dialog should have closed after confirm
  const dialogGone = await evaluate<boolean>(session, `(function() {
    var d = document.querySelector('.wechat_send_dialog');
    if (!d) return true;
    var s = window.getComputedStyle(d);
    return s.display === 'none' || s.visibility === 'hidden';
  })()`);

  if (dialogGone) {
    console.log('[wechat] ✅ Preview sent successfully! Check your WeChat.');
    return true;
  } else {
    console.log('[wechat] ✅ Preview dialog confirmed (dialog still open, may have multiple recipients).');
    return true;
  }
}

export async function postArticle(options: ArticleOptions): Promise<void> {
  const { title, content, htmlFile, markdownFile, theme, color, citeStatus = true, author, summary, images = [], cover, preview = false, previewWxname, submit = false, profileDir, cdpPort } = options;
  let { contentImages = [] } = options;
  let effectiveTitle = title || '';
  let effectiveAuthor = author || '';
  let effectiveSummary = summary || '';
  let effectiveHtmlFile = htmlFile;

  if (markdownFile) {
    console.log(`[wechat] Parsing markdown: ${markdownFile}`);
    const parsed = await parseMarkdownWithPlaceholders(markdownFile, theme, color, citeStatus);
    effectiveTitle = effectiveTitle || parsed.title;
    effectiveAuthor = effectiveAuthor || parsed.author;
    effectiveSummary = effectiveSummary || parsed.summary;
    effectiveHtmlFile = parsed.htmlPath;
    contentImages = parsed.contentImages;
    console.log(`[wechat] Title: ${effectiveTitle || '(empty)'}`);
    console.log(`[wechat] Author: ${effectiveAuthor || '(empty)'}`);
    console.log(`[wechat] Summary: ${effectiveSummary || '(empty)'}`);
    console.log(`[wechat] Found ${contentImages.length} images to insert`);
  } else if (htmlFile && fs.existsSync(htmlFile)) {
    console.log(`[wechat] Parsing HTML: ${htmlFile}`);
    const meta = parseHtmlMeta(htmlFile);
    effectiveTitle = effectiveTitle || meta.title;
    effectiveAuthor = effectiveAuthor || meta.author;
    effectiveSummary = effectiveSummary || meta.summary;
    effectiveHtmlFile = htmlFile;
    if (meta.contentImages.length > 0) {
      contentImages = meta.contentImages;
    }
    console.log(`[wechat] Title: ${effectiveTitle || '(empty)'}`);
    console.log(`[wechat] Author: ${effectiveAuthor || '(empty)'}`);
    console.log(`[wechat] Summary: ${effectiveSummary || '(empty)'}`);
    console.log(`[wechat] Found ${contentImages.length} images to insert`);
  }

  if (effectiveTitle && effectiveTitle.length > 64) throw new Error(`Title too long: ${effectiveTitle.length} chars (max 64)`);
  if (!content && !effectiveHtmlFile) throw new Error('Either --content, --html, or --markdown is required');

  let cdp: CdpConnection;
  let chrome: ReturnType<typeof import('node:child_process').spawn> | null = null;

  // Try connecting to existing Chrome: explicit port > auto-detect > launch new
  const portToTry = cdpPort ?? await findExistingChromeDebugPort();
  if (portToTry) {
    const existing = await tryConnectExisting(portToTry);
    if (existing) {
      console.log(`[cdp] Connected to existing Chrome on port ${portToTry}`);
      cdp = existing;
    } else {
      console.log(`[cdp] Port ${portToTry} not available, launching new Chrome...`);
      const launched = await launchChrome(WECHAT_URL, profileDir);
      cdp = launched.cdp;
      chrome = launched.chrome;
    }
  } else {
    const launched = await launchChrome(WECHAT_URL, profileDir);
    cdp = launched.cdp;
    chrome = launched.chrome;
  }

  try {
    console.log('[wechat] Waiting for page load...');
    await sleep(3000);

    let session: ChromeSession;
    if (!chrome) {
      // Reusing existing Chrome: find an already-logged-in tab (has token in URL)
      const allTargets = await cdp.send<{ targetInfos: Array<{ targetId: string; url: string; type: string }> }>('Target.getTargets');
      const loggedInTab = allTargets.targetInfos.find(t => t.type === 'page' && t.url.includes('mp.weixin.qq.com') && t.url.includes('token='));
      const wechatTab = loggedInTab || allTargets.targetInfos.find(t => t.type === 'page' && t.url.includes('mp.weixin.qq.com'));

      if (wechatTab) {
        console.log(`[wechat] Reusing existing tab: ${wechatTab.url.substring(0, 80)}...`);
        const { sessionId: reuseSid } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId: wechatTab.targetId, flatten: true });
        await cdp.send('Page.enable', {}, { sessionId: reuseSid });
        await cdp.send('Runtime.enable', {}, { sessionId: reuseSid });
        await cdp.send('DOM.enable', {}, { sessionId: reuseSid });
        session = { cdp, sessionId: reuseSid, targetId: wechatTab.targetId };

        // Navigate to home if not already there
        const currentUrl = await evaluate<string>(session, 'window.location.href');
        if (!currentUrl.includes('/cgi-bin/home')) {
          console.log('[wechat] Navigating to home...');
          await evaluate(session, `window.location.href = '${WECHAT_URL}cgi-bin/home?t=home/index'`);
          await sleep(5000);
        }
      } else {
        // No WeChat tab found, create one
        console.log('[wechat] No WeChat tab found, opening...');
        await cdp.send('Target.createTarget', { url: WECHAT_URL });
        await sleep(5000);
        session = await getPageSession(cdp, 'mp.weixin.qq.com');
      }
    } else {
      session = await getPageSession(cdp, 'mp.weixin.qq.com');
    }

    const url = await evaluate<string>(session, 'window.location.href');
    if (!url.includes('/cgi-bin/')) {
      console.log('[wechat] Not logged in. Please scan QR code...');
      const loggedIn = await waitForLogin(session);
      if (!loggedIn) throw new Error('Login timeout');
    }
    console.log('[wechat] Logged in.');
    await sleep(5000);

    // Wait for menu to be ready
    const menuReady = await waitForElement(session, '.new-creation__menu', 40_000);
    if (!menuReady) throw new Error('Home page menu did not load');

    const targets = await cdp.send<{ targetInfos: Array<{ targetId: string; url: string; type: string }> }>('Target.getTargets');
    const initialIds = new Set(targets.targetInfos.map(t => t.targetId));

    await clickMenuByText(session, '文章');
    await sleep(3000);

    const editorTargetId = await waitForNewTab(cdp, initialIds, 'mp.weixin.qq.com');
    console.log('[wechat] Editor tab opened.');

    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId: editorTargetId, flatten: true });
    session = { cdp, sessionId, targetId: editorTargetId };

    await cdp.send('Page.enable', {}, { sessionId });
    await cdp.send('Runtime.enable', {}, { sessionId });
    await cdp.send('DOM.enable', {}, { sessionId });

    // Wait for editor elements to fully load
    console.log('[wechat] Waiting for editor to load...');
    const editorLoaded = await waitForElement(session, '#title', 30_000);
    if (!editorLoaded) throw new Error('Editor did not load (#title not found)');
    await waitForElement(session, '.ProseMirror', 15_000);
    await sleep(2000);

    if (effectiveTitle) {
      console.log('[wechat] Filling title...');
      await evaluate(session, `(function() { const el = document.querySelector('#title'); el.focus(); el.value = ${JSON.stringify(effectiveTitle)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    }

    if (effectiveAuthor) {
      console.log('[wechat] Filling author...');
      await evaluate(session, `(function() { const el = document.querySelector('#author'); el.focus(); el.value = ${JSON.stringify(effectiveAuthor)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    }

    await sleep(500);

    if (effectiveTitle) {
      const actualTitle = await evaluate<string>(session, `document.querySelector('#title')?.value || ''`);
      if (actualTitle === effectiveTitle) {
        console.log('[wechat] Title verified OK.');
      } else {
        console.warn(`[wechat] Title verification failed. Expected: "${effectiveTitle}", got: "${actualTitle}"`);
      }
    }

    console.log('[wechat] Clicking on editor...');
    await clickElement(session, '.ProseMirror');
    await sleep(1000);

    console.log('[wechat] Ensuring editor focus...');
    await clickElement(session, '.ProseMirror');
    await sleep(500);

    if (effectiveHtmlFile && fs.existsSync(effectiveHtmlFile)) {
      console.log(`[wechat] Copying HTML content from: ${effectiveHtmlFile}`);
      await copyHtmlFromBrowser(cdp, effectiveHtmlFile, contentImages);
      await sleep(500);
      console.log('[wechat] Pasting into editor...');
      await pasteFromClipboardInEditor(session);
      await sleep(3000);

      const editorHasContent = await evaluate<boolean>(session, `
        (function() {
          const editor = document.querySelector('.ProseMirror');
          if (!editor) return false;
          const text = editor.innerText?.trim() || '';
          return text.length > 0;
        })()
      `);
      if (editorHasContent) {
        console.log('[wechat] Body content verified OK.');
      } else {
        console.warn('[wechat] Body content verification failed: editor appears empty after paste.');
      }

      if (contentImages.length > 0) {
        console.log(`[wechat] Inserting ${contentImages.length} images...`);
        for (let i = 0; i < contentImages.length; i++) {
          const img = contentImages[i]!;
          console.log(`[wechat] [${i + 1}/${contentImages.length}] Processing: ${img.placeholder}`);

          const found = await selectAndReplacePlaceholder(session, img.placeholder);
          if (!found) {
            console.warn(`[wechat] Placeholder not found: ${img.placeholder}`);
            continue;
          }

          await sleep(500);

          console.log(`[wechat] Copying image: ${path.basename(img.localPath)}`);
          await copyImageToClipboard(img.localPath);
          await sleep(300);

          console.log('[wechat] Deleting placeholder with Backspace...');
          await pressDeleteKey(session);
          await sleep(200);

          console.log('[wechat] Pasting image...');
          await pasteFromClipboardInEditor(session);
          await sleep(3000);
          await removeExtraEmptyLineAfterImage(session);
        }
        console.log('[wechat] All images inserted.');
      }
    } else if (content) {
      for (const img of images) {
        if (fs.existsSync(img)) {
          console.log(`[wechat] Pasting image: ${img}`);
          await copyImageToClipboard(img);
          await sleep(500);
          await pasteInEditor(session);
          await sleep(2000);
          await removeExtraEmptyLineAfterImage(session);
        }
      }

      console.log('[wechat] Typing content...');
      await typeText(session, content);
      await sleep(1000);

      const editorHasContent = await evaluate<boolean>(session, `
        (function() {
          const editor = document.querySelector('.ProseMirror');
          if (!editor) return false;
          const text = editor.innerText?.trim() || '';
          return text.length > 0;
        })()
      `);
      if (editorHasContent) {
        console.log('[wechat] Body content verified OK.');
      } else {
        console.warn('[wechat] Body content verification failed: editor appears empty after typing.');
      }
    }

    if (effectiveSummary) {
      console.log(`[wechat] Filling summary (after content paste): ${effectiveSummary}`);
      await evaluate(session, `
        (function() {
          const el = document.querySelector('#js_description');
          if (!el) return;
          el.focus();
          el.select();
          el.value = ${JSON.stringify(effectiveSummary)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        })()
      `);
      await sleep(500);

      const actualSummary = await evaluate<string>(session, `document.querySelector('#js_description')?.value || ''`);
      if (actualSummary === effectiveSummary) {
        console.log('[wechat] Summary verified OK.');
      } else {
        console.warn(`[wechat] Summary verification failed. Expected: "${effectiveSummary}", got: "${actualSummary}"`);
      }
    }

    // Set cover from article content (「从正文选择封面」)
    // This is the verified working approach for WeChat's new editor UI.
    // The --cover flag acts as a "cover enabled" switch; actual image comes from article body.
    if (cover || contentImages.length > 0) {
      await selectCoverFromContent(session, cdp);
    }

    if (submit) {
      console.log('[wechat] Saving as draft...');
      await evaluate(session, `document.querySelector('#js_submit button').click()`);
      await sleep(3000);

      const saved = await evaluate<boolean>(session, `!!document.querySelector('.weui-desktop-toast')`);
      if (saved) {
        console.log('[wechat] Draft saved successfully!');
      } else {
        console.log('[wechat] Waiting for save confirmation...');
        await sleep(5000);
      }
    }

    // Click preview if requested (after saving)
    if (preview) {
      const sent = await clickPreview(session, cdp, previewWxname);
      if (sent) {
        if (previewWxname) {
          console.log(`[wechat] ✅ Preview sent to: ${previewWxname}`);
          // Brief wait so user can see confirmation
          await sleep(3000);
        } else {
          // No wxname — keep Chrome open so user can interact with the dialog
          console.log('[wechat] Chrome will stay open for 120s. Close the dialog manually or Ctrl+C.');
          await sleep(120_000);
        }
      }
    }

    console.log('[wechat] Done.');
  } finally {
    // Only close CDP connection (not Chrome process itself)
    // Chrome process was launched with launchChrome() and will exit on its own
    // when the script ends, unless --preview kept it alive above.
    cdp.close();
  }
}

function printUsage(): never {
  console.log(`Post article to WeChat Official Account

Usage:
  npx -y bun wechat-article.ts [options]

Options:
  --title <text>     Article title (auto-extracted from markdown)
  --content <text>   Article content (use with --image)
  --html <path>      HTML file to paste (alternative to --content)
  --markdown <path>  Markdown file to convert and post (recommended)
  --theme <name>     Theme for markdown (default, grace, simple, modern)
  --color <name|hex> Primary color (blue, green, vermilion, etc. or hex)
  --no-cite          Disable bottom citations for ordinary external links in markdown mode
  --author <name>    Author name
  --summary <text>   Article summary
  --image <path>     Content image, can repeat (only with --content)
  --cover <path>     Cover image (封面图, required by WeChat before preview/publish)
  --submit           Save as draft
  --preview          Click preview button after saving (opens 发送预览 dialog)
  --preview-wxname <wxname>  WeChat/QQ/phone number to send preview to (requires --preview)
  --profile <dir>    Chrome profile directory
  --account <alias>  Select account by alias (for multi-account setups)
  --cdp-port <port>  Connect to existing Chrome debug port instead of launching new instance

Examples:
  npx -y bun wechat-article.ts --markdown article.md
  npx -y bun wechat-article.ts --markdown article.md --theme grace --submit
  npx -y bun wechat-article.ts --markdown article.md --cover cover.jpg --submit --preview
  npx -y bun wechat-article.ts --markdown article.md --no-cite
  npx -y bun wechat-article.ts --title "标题" --content "内容" --image img.png
  npx -y bun wechat-article.ts --title "标题" --html article.html --submit

Markdown mode:
  Images in markdown are converted to placeholders. After pasting HTML,
  each placeholder is selected, scrolled into view, deleted, and replaced
  with the actual image via paste. Ordinary external links are converted to
  bottom citations by default.
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  const images: string[] = [];
  let title: string | undefined;
  let content: string | undefined;
  let htmlFile: string | undefined;
  let markdownFile: string | undefined;
  let theme: string | undefined;
  let color: string | undefined;
  let citeStatus = true;
  let author: string | undefined;
  let summary: string | undefined;
  let cover: string | undefined;
  let preview = false;
  let previewWxname: string | undefined;
  let submit = false;
  let profileDir: string | undefined;
  let cdpPort: number | undefined;
  let accountAlias: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--title' && args[i + 1]) title = args[++i];
    else if (arg === '--content' && args[i + 1]) content = args[++i];
    else if (arg === '--html' && args[i + 1]) htmlFile = args[++i];
    else if (arg === '--markdown' && args[i + 1]) markdownFile = args[++i];
    else if (arg === '--theme' && args[i + 1]) theme = args[++i];
    else if (arg === '--color' && args[i + 1]) color = args[++i];
    else if (arg === '--cite') citeStatus = true;
    else if (arg === '--no-cite') citeStatus = false;
    else if (arg === '--author' && args[i + 1]) author = args[++i];
    else if (arg === '--summary' && args[i + 1]) summary = args[++i];
    else if (arg === '--image' && args[i + 1]) images.push(args[++i]!);
    else if (arg === '--cover' && args[i + 1]) cover = args[++i];
    else if (arg === '--preview') preview = true;
    else if (arg === '--preview-wxname' && args[i + 1]) { preview = true; previewWxname = args[++i]; }
    else if (arg === '--submit') submit = true;
    else if (arg === '--profile' && args[i + 1]) profileDir = args[++i];
    else if (arg === '--account' && args[i + 1]) accountAlias = args[++i];
    else if (arg === '--cdp-port' && args[i + 1]) cdpPort = parseInt(args[++i]!, 10);
  }

  const extConfig = loadWechatExtendConfig();
  const resolved = resolveAccount(extConfig, accountAlias);
  if (resolved.name) console.log(`[wechat] Account: ${resolved.name} (${resolved.alias})`);

  if (!author && resolved.default_author) author = resolved.default_author;

  if (!profileDir && resolved.alias) {
    profileDir = resolved.chrome_profile_path || getAccountProfileDir(resolved.alias);
  }

  if (!markdownFile && !htmlFile && !title) { console.error('Error: --title is required (or use --markdown/--html)'); process.exit(1); }
  if (!markdownFile && !htmlFile && !content) { console.error('Error: --content, --html, or --markdown is required'); process.exit(1); }

  await postArticle({ title: title || '', content, htmlFile, markdownFile, theme, color, citeStatus, author, summary, images, cover, preview, previewWxname, submit, profileDir, cdpPort });
}

await main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
