import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PersistedState } from '../shared/types'

export function readStateFile(file: string): PersistedState | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as PersistedState
    return parsed?.pets?.dakuan ? parsed : null
  } catch { return null }
}

export function atomicWriteState(file: string, contents: string) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, contents, 'utf8')
  renameSync(temporary, file)
}

export function writeStateFile(file: string, state: PersistedState) {
  if (!state?.pets?.dakuan) throw new Error('拒绝保存缺少大款数据的空白状态。')
  const contents = JSON.stringify(state, null, 2)
  const previous = existsSync(file) ? readStateFile(file) : null
  if (previous) {
    const previousSchema = Number.isSafeInteger(previous.schemaVersion) && previous.schemaVersion >= 0 ? previous.schemaVersion : 0
    if (state.schemaVersion > previousSchema) {
      const migrationBackup = `${file}.schema-${previousSchema}.bak`
      if (!existsSync(migrationBackup)) copyFileSync(file, migrationBackup)
    }
    copyFileSync(file, `${file}.bak`)
  }
  atomicWriteState(file, contents)
}
