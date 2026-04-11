// Shared helpers used across all dashboard views.
// Keeps visual vocabulary (colors, icons, badges) consistent between
// Summary, Project and Brain Link tabs.

import type { NodeRole } from "@shared/types/contract.types";

/**
 * Deterministic community color via string hash → HSL.
 * Must match the implementation inside graph.ts <script> block so the
 * Brain Link canvas and the Summary/Project cards agree on colors.
 */
export function communityColor(label: string | undefined): string {
  if (!label) return "#30363d";
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

/**
 * Same hash, brighter variant — useful for borders/glow.
 */
export function communityColorBright(label: string | undefined): string {
  if (!label) return "#484f58";
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 65%)`;
}

/**
 * Same hash, very transparent — useful for row backgrounds.
 */
export function communityColorFaint(label: string | undefined): string {
  if (!label) return "rgba(48, 54, 61, 0.1)";
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 55%, 42%, 0.1)`;
}

export function roleIcon(role: NodeRole | string | undefined): string {
  switch (role) {
    case "hub":
      return "⚡";
    case "bridge":
      return "🌉";
    case "leaf":
      return "🍃";
    case "orphan":
      return "○";
    default:
      return "·";
  }
}

/**
 * Role-specific colors. Distinct hues chosen to stand out from both
 * community hash colors and status colors.
 */
export function roleColor(role: NodeRole | string | undefined): string {
  switch (role) {
    case "hub":
      return "#f59f00"; // vivid amber
    case "bridge":
      return "#e03131"; // bold red
    case "leaf":
      return "#37b24d"; // fresh green
    case "orphan":
      return "#868e96"; // muted gray
    default:
      return "#5c7cfa"; // soft indigo (member)
  }
}

export function roleLabel(role: NodeRole | string | undefined): string {
  return role ? String(role) : "member";
}

/**
 * Modularity score banding. Newman's Q:
 *   < 0.1   → low (poorly clustered)
 *   0.1–0.3 → medium
 *   >= 0.3  → high (clear clusters)
 */
export function modularityBand(score: number): "low" | "medium" | "high" {
  if (score >= 0.3) return "high";
  if (score >= 0.1) return "medium";
  return "low";
}

export function modularityLabel(score: number): string {
  const band = modularityBand(score);
  return band === "high" ? "High" : band === "medium" ? "Medium" : "Low";
}

export function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
