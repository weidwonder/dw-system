// 体积上限清单的判定逻辑（无 `.test.` 后缀，不被用例收集）。清单形态见技术 spec §2.3。
import fs from 'node:fs'
import path from 'node:path'

const MANIFEST_KEYS = new Set(['files', 'classes', 'lines', 'blockExcluded'])
const SKIP_DIRS = new Set(['.git', 'node_modules', '.worktrees', '.claude', '.agents', '.codegraph'])

/** 仓库相对路径（`/` 分隔）的全量文件清单。 */
export function listFiles(root) {
  const out = []
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name)
      } else if (entry.isFile()) {
        out.push(rel ? `${rel}/${entry.name}` : entry.name)
      }
    }
  }
  walk(root, '')
  return out.sort()
}

/** `*` 匹配单段，`**` 匹配任意多段。 */
export function globToRegExp(glob) {
  const DIR_STAR = '<<DIRSTAR>>'
  const ANY_STAR = '<<ANYSTAR>>'
  const escaped = glob
    .split('**/').join(DIR_STAR)
    .split('**').join(ANY_STAR)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .split(DIR_STAR).join('(?:.*/)?')
    .split(ANY_STAR).join('.*')
  return new RegExp(`^${escaped}$`)
}

function bytesOf(root, rel, blockExcluded) {
  let raw = fs.readFileSync(path.join(root, rel), 'utf8')
  if (blockExcluded && blockExcluded.file === rel) {
    const start = raw.indexOf(blockExcluded.start)
    const end = raw.indexOf(blockExcluded.end)
    if (start >= 0 && end > start) raw = raw.slice(0, start) + raw.slice(end + blockExcluded.end.length)
  }
  return Buffer.byteLength(raw, 'utf8')
}

/**
 * @returns {{rows: Array<{subject:string, actual:number, max:number}>, failures: string[]}}
 */
export function checkBudgets(root, manifest) {
  const files = listFiles(root)
  const rows = []
  const failures = []
  const push = (subject, actual, max) => {
    rows.push({ subject, actual, max })
    if (actual > max) failures.push(`超限：${subject} 实测 ${actual} > 上限 ${max}（超 ${actual - max}）`)
  }

  // 点名条目的值可以是数字，也可以是 `{max, note}`。高于同类上限的条目是拍过板的例外，
  // MUST 带 note 写明理由：没有理由的例外和"为了过闸顺手上调"在清单上分不出来。
  const limitOf = v => (typeof v === 'number' ? { max: v, note: '' } : { max: v.max, note: String(v.note || '').trim() })
  const classMaxFor = rel => (manifest.classes || []).find(c => globToRegExp(c.glob).test(rel))?.max

  // 清单的顶层键是闭集。不认识的键不参与任何判定，不判红它就是一条看着在守、其实不生效的规则。
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(key)) failures.push(`清单有未知键：${key}（判定逻辑不认识它，MUST 删掉或先给它写判定）`)
  }

  const named = manifest.files || {}
  for (const [rel, value] of Object.entries(named)) {
    if (!files.includes(rel)) {
      failures.push(`清单点名的文件不存在：${rel}（改名或删除后 MUST 同步清单）`)
      continue
    }
    const { max, note } = limitOf(value)
    const classMax = classMaxFor(rel)
    if (classMax !== undefined && max > classMax && !note) failures.push(`例外缺理由：${rel} 的上限 ${max} 高于同类上限 ${classMax}，MUST 写成 {max, note}`)
    push(rel, bytesOf(root, rel, manifest.blockExcluded), max)
  }

  const claimed = new Set(Object.keys(named))
  for (const cls of manifest.classes || []) {
    const re = globToRegExp(cls.glob)
    const hits = files.filter(f => re.test(f))
    if (hits.length === 0) failures.push(`glob 零命中：${cls.glob}（目录改名后本类会静默失守）`)
    for (const rel of hits) {
      if (claimed.has(rel)) continue
      claimed.add(rel)
      push(rel, bytesOf(root, rel, manifest.blockExcluded), cls.max)
    }
  }

  for (const rule of manifest.lines || []) {
    if (!files.includes(rule.file)) {
      failures.push(`清单点名的文件不存在：${rule.file}`)
      continue
    }
    const re = new RegExp(rule.entryPattern)
    const entries = fs.readFileSync(path.join(root, rule.file), 'utf8').split(/\r?\n/).filter(l => re.test(l))
    // 一条都匹配不到 = 这条规则在空跑（索引换了行形态而 entryPattern 没跟上），MUST 判红。
    if (!entries.length) failures.push(`单条上限空跑：${rule.file} 里没有任何一行匹配 ${rule.entryPattern}`)
    let worst = 0
    for (const line of entries) {
      const size = Buffer.byteLength(line, 'utf8')
      worst = Math.max(worst, size)
      if (size > rule.maxBytes) failures.push(`超限：${rule.file} 单条 ${size} > ${rule.maxBytes}：${line.slice(0, 40)}…`)
    }
    rows.push({ subject: `${rule.file} 单条最长`, actual: worst, max: rule.maxBytes })
  }

  return { rows, failures }
}

export const DISPOSAL_ORDER =
  '处置顺序 MUST 依次为：① 把不属于这里的内容搬回它的家、留一行指针；② 属于这里但能更短的，压缩（每条命题都要留住）；' +
  '③ 内容确实需要这么多空间才抬上限——抬上限须拍板人同意，并在清单里把该条写成 {max, note}，note 写一句理由。'
