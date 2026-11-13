/**
 * Utility for client-side SVG validation and security sanitization.
 */
export function sanitizeSvgContent(svgText: string): string {
  if (!svgText) return "";

  let clean = svgText.trim();

  // Strip script tags
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Strip foreignObject tags which can embed HTML
  clean = clean.replace(/<foreignobject[\s\S]*?<\/foreignobject>/gi, "");

  // Strip inline event attributes (e.g. onload, onerror, onclick)
  clean = clean.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");

  // Replace dangerous javascript: URLs in href/xlink:href
  clean = clean.replace(/href\s*=\s*["']?\s*javascript:[^"'>\s]+/gi, 'href="#"');
  clean = clean.replace(/xlink:href\s*=\s*["']?\s*javascript:[^"'>\s]+/gi, 'xlink:href="#"');

  return clean;
}

export function isValidPngOrSvg(file: File): { valid: boolean; error?: string; type?: "png" | "svg" } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
  if (file.size > MAX_SIZE) {
    return { valid: false, error: "File size exceeds limit (Max 5MB)." };
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith(".svg") || type.includes("svg")) {
    return { valid: true, type: "svg" };
  }

  if (name.endsWith(".png") || type.includes("png")) {
    return { valid: true, type: "png" };
  }

  return { valid: false, error: "Unsupported format. Only PNG and SVG files are allowed." };
}
