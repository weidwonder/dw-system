// 规范句重复检测的实现，与用例分开放，便于对样本目录做反向自检。
// 契约：docs/spec/2026-09-17-dw-system-安装器迁移与ctx体检与机器闸-eng-spec.md §4.4（FR-016）。
import fs from 'node:fs'
import path from 'node:path'

/** 低于这个长度的归一化句子太容易撞车（"MUST NOT 顺延"一类的短语），不比。 */
export const MIN_LENGTH = 24

const NORMATIVE = /\b(MUST|SHOULD)\b/

/** 归一化：去强调符、引用符、列表符号，去全部空白与中英文标点。 */
export const normalize = (s) => s.replace(/[\s\p{P}\p{S}]+/gu, '')

/** 一份 markdown 里含规范词的句子（跳过代码围栏；按行、再按 `。；` 切）。 */
export function normativeSentences(raw) {
  const out = []
  let fenced = false
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue }
    if (fenced) continue
    if (/RFC 2119/.test(line)) continue // 「按 RFC 2119 解释规范词」是每篇的声明，不是一条规则
    for (const piece of line.split(/[。；]/)) {
      if (!NORMATIVE.test(piece)) continue
      const norm = normalize(piece)
      if ([...norm].length >= MIN_LENGTH) out.push({ text: piece.trim(), norm })
    }
  }
  return out
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir).sort()) {
    if (entry === 'node_modules') continue
    const abs = path.join(dir, entry)
    if (fs.statSync(abs).isDirectory()) walk(abs, out)
    else if (entry.endsWith('.md')) out.push(abs)
  }
  return out
}

/**
 * @param {string} root 扫描根
 * @returns {Array<{norm:string, text:string, files:string[]}>} 出现在 ≥2 个文件里的句子，files 相对 root、正斜杠、已排序
 */
export function findDuplicates(root) {
  const seen = new Map()
  for (const abs of walk(root)) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    for (const { text, norm } of normativeSentences(fs.readFileSync(abs, 'utf8'))) {
      if (!seen.has(norm)) seen.set(norm, { text, files: new Set() })
      seen.get(norm).files.add(rel)
    }
  }
  return [...seen].filter(([, v]) => v.files.size > 1)
    .map(([norm, v]) => ({ norm, text: v.text, files: [...v.files].sort() }))
    .sort((a, b) => a.norm.localeCompare(b.norm))
}

/**
 * 与白名单比对。白名单条目：{ sentence, files, reason }，三项齐全、reason 非空；
 * `sentence` 归一化后与重复句相等且 `files` 覆盖全部出现位置才算登记。
 * @returns {{unlisted:Array, stale:Array, malformed:Array}}
 */
export function compareWithAllowlist(duplicates, allow) {
  const malformed = allow.filter((e) => !e || !e.sentence || !Array.isArray(e.files) || !e.files.length || !String(e.reason || '').trim())
  const byNorm = new Map(allow.filter((e) => !malformed.includes(e)).map((e) => [normalize(e.sentence), e]))
  const unlisted = duplicates.filter((d) => {
    const e = byNorm.get(d.norm)
    return !e || d.files.some((f) => !e.files.includes(f))
  })
  const dupNorms = new Set(duplicates.map((d) => d.norm))
  const stale = [...byNorm].filter(([norm]) => !dupNorms.has(norm)).map(([, e]) => e)
  return { unlisted, stale, malformed }
}
