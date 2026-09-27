export type SeatDirection = '左' | '右'

export type Weather = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪' | '雾'

export type TreeDensity = '稀疏' | '适中' | '茂密'

export type PedestrianStatus = '稀少' | '零星' | '密集'

export interface WindowScene {
  id: string
  routeName: string
  segment: string
  seatDirection: SeatDirection
  timestamp: string
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
}

export interface SceneFormData {
  routeName: string
  segment: string
  seatDirection: SeatDirection
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
}

/** 待处理区中一条同编号冲突：本地版本与对方版本并排保留，不互相覆盖 */
export interface PendingConflict {
  id: string
  local: WindowScene
  incoming: WindowScene
  importedAt: string
  /** 导入来源设备名，用于在待处理项中标注对方 */
  fromDevice: string
}

/** 一条路线的统计信息，处理冲突后立即重算 */
export interface RouteStat {
  routeName: string
  count: number
  latestTimestamp: string | null
}
