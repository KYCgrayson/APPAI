interface StatCardProps {
  label: string;
  value: number | string;
  detail?: string;
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
      {detail && <div className="text-xs text-gray-400 mt-1">{detail}</div>}
    </div>
  );
}

export interface StackedBarSegment {
  label: string;
  count: number;
  color: string;
}

interface StackedBarProps {
  title: string;
  segments: StackedBarSegment[];
  total?: number;
}

export function StackedBar({ title, segments, total }: StackedBarProps) {
  const sum = total ?? segments.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">{sum.toLocaleString()} total</span>
      </div>

      {sum === 0 ? (
        <div className="h-3 rounded-full bg-gray-100" />
      ) : (
        <div className="flex h-3 rounded-full overflow-hidden">
          {segments.map((seg, i) => {
            const pct = (seg.count / sum) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={i}
                className="h-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label}: ${seg.count}`}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-600 truncate flex-1">{seg.label}</span>
            <span className="text-gray-900 font-medium tabular-nums">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SparkBarsProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}

export function SparkBars({
  data,
  height = 96,
  color = "#6366f1",
}: SparkBarsProps) {
  if (data.length === 0) {
    return <div className="text-sm text-gray-400">No data</div>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 800;
  const barGap = 2;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 4);
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight || 1}
              rx={2}
              fill={color}
            >
              <title>
                {d.label}: {d.value}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

interface HorizontalBarRowProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

export function HorizontalBarRow({
  label,
  value,
  max,
  color,
}: HorizontalBarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900 tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
