"use client";

import React, { useCallback, useMemo, useState } from "react";

interface EquityPoint {
  index: number;
  tradeNum: number;
  dt: string;
  pnl: number;
  cumulativePnl: number;
  isWin: boolean;
}

interface EquityCurveProps {
  data: EquityPoint[];
  stakeUsd: number;
}

export default function EquityCurve({ data, stakeUsd }: EquityCurveProps) {
  const [hoveredPoint, setHoveredPoint] = useState<EquityPoint | null>(null);

  const { points, minPnl, maxPnl, finalPnl } = useMemo(() => {
    if (!data.length) {
      return { points: [], minPnl: 0, maxPnl: 100, finalPnl: 0 };
    }

    let min = 0;
    let max = 0;
    data.forEach((d) => {
      if (d.cumulativePnl < min) min = d.cumulativePnl;
      if (d.cumulativePnl > max) max = d.cumulativePnl;
    });

    const pad = (max - min) * 0.1 || 10;
    return {
      points: data,
      minPnl: min - pad,
      maxPnl: max + pad,
      finalPnl: data[data.length - 1]?.cumulativePnl || 0,
    };
  }, [data]);

  // Downsample to max 120 points for ultra-smooth rendering if thousands of trades
  const displayPoints = useMemo(() => {
    if (points.length <= 120) return points;
    const step = Math.ceil(points.length / 120);
    const sampled: EquityPoint[] = [];
    for (let i = 0; i < points.length; i += step) {
      sampled.push(points[i]);
    }
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1]);
    }
    return sampled;
  }, [points]);

  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Stable across renders so the memoized paths below can actually be reused.
  const getX = useCallback(
    (idx: number) => padding.left + (idx / Math.max(1, displayPoints.length - 1)) * innerWidth,
    [padding.left, displayPoints.length, innerWidth],
  );

  const getY = useCallback(
    (val: number) => {
      const range = maxPnl - minPnl || 1;
      return padding.top + innerHeight - ((val - minPnl) / range) * innerHeight;
    },
    [padding.top, innerHeight, maxPnl, minPnl],
  );

  const pathD = useMemo(() => {
    if (!displayPoints.length) return "";
    return displayPoints
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d.cumulativePnl).toFixed(1)}`)
      .join(" ");
  }, [displayPoints, getX, getY]);

  const zeroY = getY(0);
  const areaD = useMemo(() => {
    if (!displayPoints.length) return "";
    const firstX = getX(0);
    const lastX = getX(displayPoints.length - 1);
    return `${pathD} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;
  }, [pathD, displayPoints, zeroY, getX]);

  const isProfitable = finalPnl >= 0;

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">
            Cumulative Strategy Growth (PnL)
          </h3>
          <p className="text-xs text-neutral-500">
            Simulated portfolio performance across {points.length.toLocaleString()} executions (${stakeUsd} stake)
          </p>
        </div>
        {hoveredPoint ? (
          <div className="flex items-center gap-3 text-xs font-mono bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg">
            <span className="text-neutral-400">Trade #{hoveredPoint.tradeNum}:</span>
            <span className={hoveredPoint.isWin ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {hoveredPoint.pnl >= 0 ? "+" : ""}${hoveredPoint.pnl.toFixed(2)}
            </span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-300">
              Cum: ${hoveredPoint.cumulativePnl.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="text-xs font-mono text-neutral-400">
            Final:{" "}
            <span className={isProfitable ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {isProfitable ? "+" : ""}${finalPnl.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="equityGradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="equityGradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = minPnl + (maxPnl - minPnl) * (1 - pct);
            const y = padding.top + pct * innerHeight;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1c1f28"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  fill="#64748b"
                >
                  ${val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          {zeroY >= padding.top && zeroY <= padding.top + innerHeight && (
            <line
              x1={padding.left}
              y1={zeroY}
              x2={width - padding.right}
              y2={zeroY}
              stroke="#334155"
              strokeWidth="1.5"
            />
          )}

          {/* Area fill */}
          <path
            d={areaD}
            fill={isProfitable ? "url(#equityGradGreen)" : "url(#equityGradRed)"}
          />

          {/* Curve line */}
          <path
            d={pathD}
            fill="none"
            stroke={isProfitable ? "#10b981" : "#f43f5e"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive touch/hover points */}
          {displayPoints.map((pt, i) => {
            const cx = getX(i);
            const cy = getY(pt.cumulativePnl);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="4"
                className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer fill-white stroke-emerald-400 stroke-2"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
