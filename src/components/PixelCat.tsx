import type { CatProgress, CatSize } from '../types'

interface PixelCatProps {
  progress: CatProgress
  overloadRatio?: number   // >1 means today's tasks exceed daily capacity
}

export default function PixelCat({ progress, overloadRatio = 0 }: PixelCatProps) {
  const { level, exp, expToNextLevel, size } = progress
  const isWarning = overloadRatio >= 0.8 && overloadRatio < 1.0
  const isOverload = overloadRatio >= 1.0

  // Get cat colors based on level
  const getCatColors = () => {
    if (size === 'mega') {
      return { body: '#8B5CF6', face: '#A78BFA', eyes: '#4C1D95', mouth: '#4C1D95', accent: '#FDE68A' }
    }
    if (size === 'large') {
      return { body: '#10B981', face: '#34D399', eyes: '#065F46', mouth: '#065F46', accent: '#FDE68A' }
    }
    if (size === 'medium') {
      return { body: '#3B82F6', face: '#60A5FA', eyes: '#1E3A8A', mouth: '#1E3A8A', accent: '#FDE68A' }
    }
    if (size === 'small') {
      return { body: '#F59E0B', face: '#FCD34D', eyes: '#1F2937', mouth: '#1F2937', accent: '#FDE68A' }
    }
    // baby
    return { body: '#6B7280', face: '#9CA3AF', eyes: '#1F2937', mouth: '#1F2937', accent: '#FDE68A' }
  }

  const colors = getCatColors()

  // Get size multiplier for SVG scaling
  const getSizeMultiplier = () => {
    const sizes: Record<CatSize, number> = {
      baby: 1,
      small: 1.2,
      medium: 1.4,
      large: 1.6,
      mega: 1.8,
    }
    return sizes[size]
  }

  const sizeMultiplier = getSizeMultiplier()

  // Get encouraging message
  const getMessage = () => {
    if (isOverload) {
      const msgs = [
        '喵！！任务太多啦，做不完的(>﹏<)',
        '喵呜～ 今天要爆炸了！主人注意休息～',
        '喵！超载了！减减任务吧ฅ(°ω°ฅ)',
      ]
      return msgs[Math.floor(Date.now() / 10000) % msgs.length]
    }
    if (isWarning) {
      const msgs = [
        `喵～ 今天任务挺多哦，加油！`,
        `喵！快填满了，悠着点～`,
      ]
      return msgs[Math.floor(Date.now() / 10000) % msgs.length]
    }
    const messages = [
      `喵～ Lv.${level}`,
      `喵！Lv.${level} 加油！`,
      `喵呜～ Lv.${level}`,
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }

  const expPercentage = (exp / expToNextLevel) * 100

  return (
    <div className="pixel-cat">
      <div
        className={`cat-sprite ${isOverload ? 'cat-panic' : isWarning ? 'cat-worry' : ''}`}
        style={{ '--sm': sizeMultiplier } as React.CSSProperties}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 12 12"
          xmlns="http://www.w3.org/2000/svg"
          shapeRendering="crispEdges"
        >
          {/* Ears */}
          <rect x="2" y="1" width="1" height="1" fill={colors.body} />
          <rect x="9" y="1" width="1" height="1" fill={colors.body} />
          <rect x="3" y="0" width="1" height="1" fill={colors.body} />
          <rect x="8" y="0" width="1" height="1" fill={colors.body} />

          {/* Head top */}
          <rect x="2" y="2" width="8" height="1" fill={colors.body} />

          {/* Head middle with eyes */}
          <rect x="1" y="3" width="10" height="1" fill={colors.body} />
          <rect x="4" y="3" width="1" height="1" fill={colors.eyes} />
          <rect x="7" y="3" width="1" height="1" fill={colors.eyes} />

          {/* Eye sparkles for higher levels */}
          {(size === 'large' || size === 'mega') && (
            <>
              <rect x="3" y="2" width="1" height="1" fill={colors.accent} />
              <rect x="8" y="2" width="1" height="1" fill={colors.accent} />
            </>
          )}

          {/* Head lower with nose */}
          <rect x="1" y="4" width="10" height="1" fill={colors.face} />
          <rect x="5" y="4" width="1" height="1" fill="#EC4899" />
          <rect x="6" y="4" width="1" height="1" fill="#EC4899" />

          {/* Mouth area */}
          <rect x="2" y="5" width="8" height="1" fill={colors.face} />
          <rect x="5" y="5" width="1" height="1" fill={colors.mouth} />
          <rect x="6" y="5" width="1" height="1" fill={colors.mouth} />

          {/* Chin */}
          <rect x="2" y="6" width="8" height="1" fill={colors.face} />
          <rect x="3" y="7" width="6" height="1" fill={colors.body} />

          {/* Body */}
          <rect x="3" y="8" width="6" height="1" fill={colors.body} />
          <rect x="3" y="9" width="6" height="1" fill={colors.body} />

          {/* Belly */}
          <rect x="4" y="8" width="4" height="1" fill={colors.face} />
          <rect x="4" y="9" width="4" height="1" fill={colors.face} />

          {/* Paws */}
          <rect x="2" y="9" width="1" height="1" fill={colors.face} />
          <rect x="9" y="9" width="1" height="1" fill={colors.face} />

          {/* Crown for mega cat */}
          {size === 'mega' && (
            <>
              <rect x="4" y="0" width="1" height="1" fill="#FCD34D" />
              <rect x="5" y="0" width="1" height="1" fill="#FCD34D" />
              <rect x="6" y="0" width="1" height="1" fill="#FCD34D" />
              <rect x="7" y="0" width="1" height="1" fill="#FCD34D" />
            </>
          )}

          {/* Tail */}
          <rect x="9" y="8" width="2" height="1" fill={colors.body} />
        </svg>
      </div>
      <div className="cat-info">
        <div className="cat-message">{getMessage()}</div>
        <div className="exp-bar">
          <div className="exp-fill" style={{ width: `${expPercentage}%` }}></div>
        </div>
        <div className="exp-text">{exp}/{expToNextLevel}</div>
      </div>
    </div>
  )
}
