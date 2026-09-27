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

/** 待处理区中的一条冲突：同编号记录的本地版本与外来版本 */
export interface PendingConflict {
  id: string
  local: WindowScene
  incoming: WindowScene
  createdAt: string
}

/** 导入交换码后的统计结果 */
export interface ImportSummary {
  added: number
  skipped: number
  conflicted: number
  invalid: number
}

/** 单条路线的计数与最近采样时间 */
export interface RouteStats {
  routeName: string
  count: number
  latestTimestamp: string | null
}
