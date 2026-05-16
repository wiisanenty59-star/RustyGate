import { memo } from "react";

const COLORS: Record<string, string> = {
  red: "#ef4444", orange: "#f97316", yellow: "#eab308", green: "#22c55e",
  blue: "#3b82f6", purple: "#a855f7", pink: "#ec4899", cyan: "#06b6d4",
  white: "#ffffff", gray: "#9ca3af", black: "#000000",
};

interface Segment {
  type: "text" | "bold" | "italic" | "underline" | "strike" | "color" | "size" | "img" | "url" | "quote" | "code" | "br";
  content?: Segment[];
  text?: string;
  color?: string;
  size?: string;
  href?: string;
  src?: string;
}

function parse(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  const n = input.length;

  function peek(): string {
    if (i >= n) return "";
    const rest = input.slice(i);
    const tagMatch = rest.match(/^\[(\/?[a-zA-Z]+(?:=[^\]]*)?)\]/);
    return tagMatch ? tagMatch[0] : "";
  }

  function parseUntilClose(closeTag: string): Segment[] {
    const result: Segment[] = [];
    let text = "";
    while (i < n) {
      if (input[i] === "\n") {
        if (text) { result.push({ type: "text", text }); text = ""; }
        result.push({ type: "br" });
        i++;
        continue;
      }
      const tag = peek();
      if (!tag) { text += input[i++]; continue; }
      if (tag === `[${closeTag}]`) { i += tag.length; break; }
      if (text) { result.push({ type: "text", text }); text = ""; }
      i += tag.length;
      const inner = tag.slice(1, -1);
      if (inner === "b") { result.push({ type: "bold", content: parseUntilClose("/b") }); }
      else if (inner === "i") { result.push({ type: "italic", content: parseUntilClose("/i") }); }
      else if (inner === "u") { result.push({ type: "underline", content: parseUntilClose("/u") }); }
      else if (inner === "s") { result.push({ type: "strike", content: parseUntilClose("/s") }); }
      else if (inner.startsWith("color=")) { result.push({ type: "color", color: inner.slice(6), content: parseUntilClose("/color") }); }
      else if (inner.startsWith("size=")) { result.push({ type: "size", size: inner.slice(5), content: parseUntilClose("/size") }); }
      else if (inner.startsWith("url=")) { result.push({ type: "url", href: inner.slice(4), content: parseUntilClose("/url") }); }
      else if (inner === "url") { result.push({ type: "url", href: undefined, content: parseUntilClose("/url") }); }
      else if (inner === "img") { result.push({ type: "img", src: collectText() }); skipClose("/img"); }
      else if (inner === "quote") { result.push({ type: "quote", content: parseUntilClose("/quote") }); }
      else if (inner === "code") { result.push({ type: "code", content: parseUntilClose("/code") }); }
      else { result.push({ type: "text", text: tag }); }
    }
    if (text) result.push({ type: "text", text });
    return result;
  }

  function collectText(): string {
    let t = "";
    while (i < n && !input.slice(i).startsWith("[")) { t += input[i++]; }
    return t;
  }

  function skipClose(tag: string) {
    const rest = input.slice(i);
    if (rest.startsWith(`[${tag}]`)) i += tag.length + 2;
  }

  // Bootstrap
  let text = "";
  while (i < n) {
    if (input[i] === "\n") {
      if (text) { segments.push({ type: "text", text }); text = ""; }
      segments.push({ type: "br" });
      i++;
      continue;
    }
    const tag = peek();
    if (!tag) { text += input[i++]; continue; }
    if (text) { segments.push({ type: "text", text }); text = ""; }
    i += tag.length;
    const inner = tag.slice(1, -1);
    if (inner === "b") { segments.push({ type: "bold", content: parseUntilClose("/b") }); }
    else if (inner === "i") { segments.push({ type: "italic", content: parseUntilClose("/i") }); }
    else if (inner === "u") { segments.push({ type: "underline", content: parseUntilClose("/u") }); }
    else if (inner === "s") { segments.push({ type: "strike", content: parseUntilClose("/s") }); }
    else if (inner.startsWith("color=")) { segments.push({ type: "color", color: inner.slice(6), content: parseUntilClose("/color") }); }
    else if (inner.startsWith("size=")) { segments.push({ type: "size", size: inner.slice(5), content: parseUntilClose("/size") }); }
    else if (inner.startsWith("url=")) { segments.push({ type: "url", href: inner.slice(4), content: parseUntilClose("/url") }); }
    else if (inner === "url") { segments.push({ type: "url", href: undefined, content: parseUntilClose("/url") }); }
    else if (inner === "img") {
      const src = collectText(); skipClose("/img");
      segments.push({ type: "img", src });
    }
    else if (inner === "quote") { segments.push({ type: "quote", content: parseUntilClose("/quote") }); }
    else if (inner === "code") { segments.push({ type: "code", content: parseUntilClose("/code") }); }
    else { segments.push({ type: "text", text: tag }); }
  }
  if (text) segments.push({ type: "text", text });
  return segments;
}

function RenderSegments({ segments }: { segments: Segment[] }): React.ReactNode {
  return segments.map((seg, i) => {
    switch (seg.type) {
      case "text": return <span key={i}>{seg.text}</span>;
      case "br": return <br key={i} />;
      case "bold": return <strong key={i} className="font-bold"><RenderSegments segments={seg.content ?? []} /></strong>;
      case "italic": return <em key={i} className="italic"><RenderSegments segments={seg.content ?? []} /></em>;
      case "underline": return <u key={i}><RenderSegments segments={seg.content ?? []} /></u>;
      case "strike": return <s key={i}><RenderSegments segments={seg.content ?? []} /></s>;
      case "color": {
        const c = seg.color ?? "";
        const cssColor = COLORS[c] ?? (c.startsWith("#") ? c : undefined);
        return <span key={i} style={cssColor ? { color: cssColor } : {}}><RenderSegments segments={seg.content ?? []} /></span>;
      }
      case "size": {
        const px = Math.min(Math.max(parseInt(seg.size ?? "14", 10), 10), 36);
        return <span key={i} style={{ fontSize: `${px}px` }}><RenderSegments segments={seg.content ?? []} /></span>;
      }
      case "url": {
        const href = seg.href ?? (seg.content?.[0]?.text ?? "#");
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 break-all">
            <RenderSegments segments={seg.content ?? [{ type: "text", text: href }]} />
          </a>
        );
      }
      case "img": {
        if (!seg.src?.trim()) return null;
        return (
          <span key={i} className="block my-2">
            <img
              src={seg.src.trim()}
              alt="embedded"
              className="max-w-full max-h-[400px] object-contain rounded border border-border/40"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </span>
        );
      }
      case "quote": return (
        <blockquote key={i} className="border-l-4 border-primary/40 pl-3 my-2 text-muted-foreground italic bg-muted/10 py-1">
          <RenderSegments segments={seg.content ?? []} />
        </blockquote>
      );
      case "code": return (
        <code key={i} className="bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded text-xs font-mono text-primary">
          <RenderSegments segments={seg.content ?? []} />
        </code>
      );
      default: return null;
    }
  });
}

interface PostBodyProps {
  text: string;
  className?: string;
}

export const PostBody = memo(function PostBody({ text, className }: PostBodyProps) {
  const segments = parse(text);
  return (
    <div className={`font-mono text-sm leading-relaxed whitespace-pre-wrap break-words ${className ?? ""}`}>
      <RenderSegments segments={segments} />
    </div>
  );
});
