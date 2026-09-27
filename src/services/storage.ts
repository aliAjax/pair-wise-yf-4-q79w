import type { WindowScene, PendingConflict, RouteStat } from '@/types'

const STORAGE_KEY = 'bus_window_scenes'
const PENDING_KEY = 'bus_window_scenes_pending'

export function getAllScenes(): WindowScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WindowScene[]
  } catch {
    return []
  }
}

function writeAllScenes(scenes: WindowScene[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function saveScene(scene: WindowScene): void {
  const scenes = getAllScenes()
  scenes.push(scene)
  writeAllScenes(scenes)
}

export function deleteScene(id: string): void {
  const scenes = getAllScenes().filter((s) => s.id !== id)
  writeAllScenes(scenes)
}

export function getScenesByRoute(routeName: string): WindowScene[] {
  return getAllScenes()
    .filter((s) => s.routeName === routeName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getAllRouteNames(): string[] {
  const scenes = getAllScenes()
  const routeSet = new Set(scenes.map((s) => s.routeName))
  return Array.from(routeSet).sort()
}

export function getRandomScene(): WindowScene | null {
  const scenes = getAllScenes()
  if (scenes.length === 0) return null
  return scenes[Math.floor(Math.random() * scenes.length)]
}

// ---------- 待处理区 ----------

export function getAllPending(): PendingConflict[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PendingConflict[]
  } catch {
    return []
  }
}

function writeAllPending(pending: PendingConflict[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

/** 按编号 upsert 一条待处理项；同编号重复导入时更新对方版本，不新增重复项 */
export function upsertPending(conflict: PendingConflict): void {
  const pending = getAllPending()
  const idx = pending.findIndex((p) => p.id === conflict.id)
  if (idx >= 0) {
    pending[idx] = conflict
  } else {
    pending.push(conflict)
  }
  writeAllPending(pending)
}

export function removePending(id: string): void {
  writeAllPending(getAllPending().filter((p) => p.id !== id))
}

// ---------- 交换导入 / 冲突处理 ----------

/** 批量追加新记录（已确认本机无同编号） */
export function addScenes(scenes: WindowScene[]): void {
  if (scenes.length === 0) return
  writeAllScenes([...getAllScenes(), ...scenes])
}

/**
 * 采用对方版本：用编号定位并整体替换本机记录；
 * 若本机记录此前已被删除，则作为新记录补回。
 */
export function replaceScene(scene: WindowScene): void {
  const scenes = getAllScenes()
  const idx = scenes.findIndex((s) => s.id === scene.id)
  if (idx >= 0) {
    scenes[idx] = scene
  } else {
    scenes.push(scene)
  }
  writeAllScenes(scenes)
}

/**
 * 路线计数与最近采样时间，从主记录实时聚合。
 * 冲突处理后由调用方重新读取，保证页面立即反映最新结果。
 */
export function getRouteStats(): RouteStat[] {
  const map = new Map<string, RouteStat>()
  for (const scene of getAllScenes()) {
    const stat = map.get(scene.routeName)
    if (!stat) {
      map.set(scene.routeName, {
        routeName: scene.routeName,
        count: 1,
        latestTimestamp: scene.timestamp,
      })
    } else {
      stat.count += 1
      const latest = stat.latestTimestamp
      if (latest === null || new Date(scene.timestamp).getTime() > new Date(latest).getTime()) {
        stat.latestTimestamp = scene.timestamp
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.routeName.localeCompare(b.routeName, 'zh-Hans-CN'),
  )
}
