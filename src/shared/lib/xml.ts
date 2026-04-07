export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlElement(
  tag: string,
  attrs?: Record<string, string | number | boolean>,
  children?: string
): string {
  const attrStr = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
        .join("")
    : "";

  if (children === undefined || children === "") {
    return `<${tag}${attrStr} />`;
  }
  return `<${tag}${attrStr}>${children}</${tag}>`;
}

export function xmlDocument(rootContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${rootContent}`;
}

export function toXml(data: unknown, tag: string): string {
  if (data === null || data === undefined) {
    return xmlElement(tag);
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return xmlElement(tag, undefined, escapeXml(String(data)));
  }

  if (Array.isArray(data)) {
    const itemTag = tag.endsWith("s") ? tag.slice(0, -1) : "item";
    const children = data.map((item) => toXml(item, itemTag)).join("\n");
    return xmlElement(tag, { count: data.length }, `\n${children}\n`);
  }

  if (typeof data === "object") {
    const children = Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => toXml(value, key))
      .join("\n");
    return xmlElement(tag, undefined, `\n${children}\n`);
  }

  return xmlElement(tag, undefined, escapeXml(String(data)));
}

export function xmlSuccess(tool: string, content: string): string {
  return xmlDocument(
    xmlElement("zero-human", { tool, status: "success" }, `\n${content}\n`)
  );
}

export function xmlError(tool: string, code: string, message: string): string {
  return xmlDocument(
    xmlElement(
      "zero-human",
      { tool, status: "error" },
      `\n${xmlElement("error", { code }, `\n${xmlElement("message", undefined, escapeXml(message))}\n`)}\n`
    )
  );
}
