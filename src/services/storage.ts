import type { WindowScene, PendingConflict, RouteStats } from '@/types'

const STORAGE_KEY = 'bus_window_scenes'
const PENDING_KEY = 'bus_window_scenes_pending'

export function getAllScenes(): WindowScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WindowScene[]) : []
  } catch {
    return []
  }
}

export function saveScene(scene: WindowScene): void {
  const scenes = getAllScenes()
  scenes.push(scene)
  writeAllScenes(scenes)
}

/** 整表写入，供导入与冲突处理后统一落库 */
export function writeAllScenes(scenes: WindowScene[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
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

/* ---------------- 待处理区 ---------------- */

export function getPendingConflicts(): PendingConflict[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingConflict[]) : []
  } catch {
    return []
  }
}

export function writePendingConflicts(pending: PendingConflict[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

/** 路线计数与最近采样时间，依据当前正式记录实时重算 */
export function getRouteStats(): RouteStats[] {
  const map = new Map<string, RouteStats>()
  for (const scene of getAllScenes()) {
    const existing = map.get(scene.routeName)
    if (!existing) {
      map.set(scene.routeName, {
        routeName: scene.routeName,
        count: 1,
        latestTimestamp: scene.timestamp,
      })
    } else {
      existing.count += 1
      if (
        existing.latestTimestamp === null ||
        new Date(scene.timestamp).getTime() > new Date(existing.latestTimestamp).getTime()
      ) {
        existing.latestTimestamp = scene.timestamp
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.routeName.localeCompare(b.routeName))
}
