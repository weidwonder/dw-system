// 按文件名在 dw-system/skills/ 下定位 skill 文档。
// 分册的文件名在整棵 skills 树里唯一，测试据此取文件，不写死它住在哪个 skill 里。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const skillsRoot = path.join(repoRoot, 'dw-system', 'skills')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules') continue
    const abs = path.join(dir, entry)
    if (statSync(abs).isDirectory()) walk(abs, out)
    else out.push(abs)
  }
  return out
}

const all = walk(skillsRoot)

/**
 * @param {string} name 文件名，或带父目录的结尾片段（`dw-worktree/SKILL.md`、`collab/solo.md`）
 * @returns {string} 绝对路径；找不到或命中多份时抛错
 */
export function skillFile(name) {
  const tail = path.sep + name.split('/').join(path.sep)
  const hits = all.filter(abs => abs.endsWith(tail))
  if (hits.length !== 1) {
    throw new Error(`skillFile(${name})：期望恰好 1 份，实得 ${hits.length} 份${hits.length ? '：' + hits.join('、') : ''}`)
  }
  return hits[0]
}

export const readSkillFile = name => readFileSync(skillFile(name), 'utf8')

/** 某个 skill 的入口加全部 references，拼成一段文本；用于"这条判据在这个 skill 里"一类断言。 */
export function skillCorpus(skill) {
  const root = path.join(skillsRoot, skill)
  return walk(root)
    .filter(abs => abs.endsWith('.md') && (path.dirname(abs) === root || abs.includes(`${path.sep}references${path.sep}`)))
    .map(abs => readFileSync(abs, 'utf8'))
    .join('\n')
}

/** 仓库内相对路径，统一正斜杠。 */
export const rel = abs => path.relative(repoRoot, abs).split(path.sep).join('/')
