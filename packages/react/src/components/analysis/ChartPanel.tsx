import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartData } from "@agent-kit/core";

import { useKit } from "../../context/KitContext";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Row {
  label: string;
  value: number;
}

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };

/** The same value the mark shows, value first and label after. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: Row }[];
  label?: string | number;
}) {
  const { fmt } = useKit();
  const entry = payload?.[0];
  if (!active || !entry) return null;
  return (
    <div className="chart-tooltip">
      <strong data-numeric>{fmt.count(Number(entry.value ?? 0))}</strong>
      <span>{entry.payload?.label ?? label}</span>
    </div>
  );
}

function compactOf(count: (value: number) => string, suffix: string) {
  return (value: number): string => (value >= 1000 ? `${count(Math.round(value / 100) / 10)}${suffix}` : count(value));
}

/**
 * The chart a run asked for, drawn from its own numbers. One series, so
 * one colour and no legend; a pie is the one form with several hues, and those come
 * in the validated order and carry a legend, because colour may not be the only way
 * to tell its slices apart.
 *
 * Long labels turn a column chart on its side: long names read horizontally or not
 * at all.
 */
export function ChartView({ chart, height = 320 }: { chart: ChartData; height?: number }) {
  const { fmt, t } = useKit();
  const compact = useMemo(() => compactOf(fmt.count, t("chart.thousand")), [fmt, t]);
  const reduced = useReducedMotion();
  const data = useMemo<Row[]>(
    () => chart.labels.map((label, index) => ({ label, value: chart.values[index] ?? 0 })),
    [chart.labels, chart.values],
  );
  const sideways = chart.labels.length > 7 || chart.labels.some((label) => label.length > 9);
  const longest = Math.max(...chart.labels.map((label) => label.length));
  const animated = !reduced;

  return (
    <div className="chart-view">
      {chart.title && <figcaption>{chart.title}</figcaption>}
      <div className="chart-plot" style={{ height: chart.type !== "pie" && sideways ? Math.max(height, data.length * 30 + 30) : height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "pie" ? (
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={1}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={animated}
              >
                {data.map((row, index) => (
                  <Cell key={row.label} fill={`var(--chart-${(index % 8) + 1})`} />
                ))}
              </Pie>
            </PieChart>
          ) : chart.type === "line" ? (
            <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} />
              <Line
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={animated}
              />
            </LineChart>
          ) : sideways ? (
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={Math.min(170, longest * 7 + 12)}
                interval={0}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--secondary)", opacity: 0.5 }} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={animated} />
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--secondary)", opacity: 0.5 }} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={animated} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {chart.type === "pie" && (
        <ul className="chart-legend">
          {data.map((row, index) => (
            <li key={row.label}>
              <span style={{ background: `var(--chart-${(index % 8) + 1})` }} aria-hidden="true" />
              {row.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The panel's tab: the chart, and its numbers as a table so nothing lives only in a hover. */
export function ChartPanel({ chart }: { chart: ChartData }) {
  const { t, fmt } = useKit();
  return (
    <section className="chart-panel">
      <ChartView chart={chart} />
      <table className="chart-table">
        <thead>
          <tr>
            <th scope="col">{t("chart.category")}</th>
            <th scope="col" data-numeric>
              {t("chart.value")}
            </th>
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((label, index) => (
            <tr key={label}>
              <td>{label}</td>
              <td data-numeric>{fmt.count(chart.values[index] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
