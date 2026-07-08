interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function MiniChart({ data, color = "var(--accent)", width = 200, height = 60, fill = true }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const fillPath = `M${pad},${pad + h} L${line} L${pad + w},${pad + h} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {fill && (
        <path d={fillPath} fill={color} opacity="0.12" />
      )}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        return i === data.length - 1 ? (
          <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
        ) : null;
      })}
    </svg>
  );
}
