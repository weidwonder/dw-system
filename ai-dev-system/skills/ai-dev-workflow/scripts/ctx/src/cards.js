// cards.js — Engineering Context 的读取与解析层（零依赖，跨平台）
import fs from 'node:fs';
import path from 'node:path';

/**
 * 把一份 markdown 按 `## 标题` 切成段落映射。
 * @returns {Record<string,string>} 标题 -> 段落正文
 */
function splitSections(raw) {
  const sections = {};
  const lines = raw.split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join('\n').trim();
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim();
      buf = [];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * 读取 engineering-context/cards/*.md 下的全部 card。
 * @param {string} ctxDir engineering-context 目录
 * @returns {Array<{service:string, path:string, sections:Record<string,string>, raw:string}>}
 */
export function loadCards(ctxDir) {
  const cardsDir = path.join(ctxDir, 'cards');
  if (!fs.existsSync(cardsDir)) return [];
  return fs
    .readdirSync(cardsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const full = path.join(cardsDir, f);
      const raw = fs.readFileSync(full, 'utf8');
      return {
        service: path.basename(f, '.md'),
        path: path.join('cards', f),
        sections: splitSections(raw),
        raw,
      };
    });
}

/**
 * 解析 capability-registry.md 的 markdown 表格。
 * 取第一张表（表头含 "Capability"）。
 * @returns {Array<{capability, businessMeaning, canonicalRepo, canonicalApi, deprecated, compatWindow, owner, testEntry, freshness, reason}>}
 */
export function loadRegistry(ctxDir) {
  const file = path.join(ctxDir, 'capability-registry.md');
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    const cells = parseTableRow(line);
    if (!cells) {
      if (inTable) break; // 表格结束
      continue;
    }
    // 表头行
    if (!inTable) {
      if (/capability/i.test(cells[0])) {
        inTable = true;
      }
      continue;
    }
    // 分隔行 |---|---|
    if (cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '')) {
      continue;
    }
    rows.push({
      capability: cells[0] || '',
      businessMeaning: cells[1] || '',
      canonicalRepo: cells[2] || '',
      canonicalApi: cells[3] || '',
      deprecated: cells[4] || '',
      compatWindow: cells[5] || '',
      owner: cells[6] || '',
      testEntry: cells[7] || '',
      freshness: cells[8] || '',
      reason: cells[9] || '',
    });
  }
  return rows;
}

/** 解析一行 markdown 表格；非表格行返回 null。 */
function parseTableRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  // 去掉首尾 | 再按 | 切；不处理转义 |（card 内容避免裸 |）
  return t
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * 生成 cite：path + anchor + 最近确认时间。
 * @returns {string}
 */
export function makeCite(cardPath, anchorText, confirmedAt) {
  return `[cite: ${cardPath}#${anchorText} @${confirmedAt}]`;
}
