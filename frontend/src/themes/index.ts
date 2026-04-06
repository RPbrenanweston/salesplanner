import { salesplanner } from './salesplanner'
import { stoic } from './stoic'
import { manifestation } from './manifestation'
import { starSign } from './star-sign'
import { adhd } from './adhd'
import { caring } from './caring'
import { athlete } from './athlete'
import { weightLoss } from './weight-loss'
import type { ThemeConfig } from './types'

export type { ThemeConfig }
export type { ThemeColors, ThemeFonts, ThemeFeatures, ThemeLabels } from './types'

const themeRegistry: Record<string, ThemeConfig> = {
  salesplanner,
  stoic,
  manifestation,
  'star-sign': starSign,
  adhd,
  caring,
  athlete,
  'weight-loss': weightLoss,
}

export function getTheme(id: string): ThemeConfig {
  return themeRegistry[id] ?? themeRegistry['salesplanner']
}

export {
  salesplanner,
  stoic,
  manifestation,
  starSign,
  adhd,
  caring,
  athlete,
  weightLoss,
}
