import { PieChart } from '@mui/x-charts/PieChart'
import { useCallback } from 'react'

export interface ChartSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: ChartSegment[]
  size?: number
  title?: string
  showLegend?: boolean
  centerLabel?: string
  centerValue?: string
}

export function DonutChart({
  segments,
  size = 160,
  title,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0)

  // Prepare data without labels in tooltip (we'll show custom format)
  const data = segments.map((segment, index) => ({
    id: index,
    value: segment.value,
    color: segment.color,
  }))

  const displayValue = centerValue ?? (total > 0 ? `${total}` : '0')

  // Custom tooltip formatter to show "Label - XX%"
  const valueFormatter = useCallback((item: { value: number }, context: { dataIndex: number }) => {
    const segment = segments[context.dataIndex]
    if (!segment || total === 0) return ''
    const percentage = Math.round((item.value / total) * 100)
    return `${segment.label} - ${percentage}%`
  }, [segments, total])

  return (
    <div className="flex flex-col items-center min-w-0">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">{title}</h4>
      )}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <PieChart
          series={[
            {
              data: data.filter(d => d.value > 0),
              innerRadius: size * 0.32,
              outerRadius: size * 0.45,
              paddingAngle: 1,
              cornerRadius: 3,
              startAngle: -90,
              endAngle: 270,
              cx: size / 2 - 1,
              cy: size / 2 - 1,
              valueFormatter,
            },
          ]}
          width={size}
          height={size}
          skipAnimation={false}
          margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
          slots={{ legend: () => null }}
        />
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">
            {displayValue}
          </span>
          {centerLabel && (
            <span className="text-xs text-gray-500">{centerLabel}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-2 space-y-0.5 w-full max-w-[160px]">
          {segments.map((segment, index) => {
            const percentage = total > 0 ? Math.round((segment.value / total) * 100) : 0
            return (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-gray-600 truncate flex-1">{segment.label}</span>
                <span className="font-medium text-gray-900 flex-shrink-0">
                  {percentage}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
