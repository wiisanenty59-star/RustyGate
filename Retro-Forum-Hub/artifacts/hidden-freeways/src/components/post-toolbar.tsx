import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold, Italic, Underline, Strikethrough, Image, Link, Quote, Code2,
  Palette, ZoomIn,
} from "lucide-react";

interface PostEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  required?: boolean;
}

const COLORS = [
  { name: "red", hex: "#ef4444" }, { name: "orange", hex: "#f97316" },
  { name: "yellow", hex: "#eab308" }, { name: "green", hex: "#22c55e" },
  { name: "blue", hex: "#3b82f6" }, { name: "purple", hex: "#a855f7" },
  { name: "pink", hex: "#ec4899" }, { name: "cyan", hex: "#06b6d4" },
  { name: "white", hex: "#ffffff" }, { name: "gray", hex: "#9ca3af" },
];

export function PostEditor({ value, onChange, placeholder, rows = 6, className, required }: PostEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [imgUrl, setImgUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imgOpen, setImgOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  function wrap(open: string, close: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + open + selected + close + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + open.length, start + open.length + selected.length);
    });
  }

  function insert(text: string) {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const next = value.slice(0, pos) + text + value.slice(pos);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos + text.length, pos + text.length); });
  }

  function insertImg() {
    if (!imgUrl.trim()) return;
    insert(`[img]${imgUrl.trim()}[/img]`);
    setImgUrl("");
    setImgOpen(false);
  }

  function insertLink() {
    if (!linkUrl.trim()) return;
    const label = linkText.trim() || linkUrl.trim();
    insert(`[url=${linkUrl.trim()}]${label}[/url]`);
    setLinkUrl("");
    setLinkText("");
    setLinkOpen(false);
  }

  const tools = [
    { icon: Bold,          title: "Bold",       action: () => wrap("[b]", "[/b]") },
    { icon: Italic,        title: "Italic",     action: () => wrap("[i]", "[/i]") },
    { icon: Underline,     title: "Underline",  action: () => wrap("[u]", "[/u]") },
    { icon: Strikethrough, title: "Strike",     action: () => wrap("[s]", "[/s]") },
    { icon: Quote,         title: "Quote",      action: () => wrap("[quote]", "[/quote]") },
    { icon: Code2,         title: "Code",       action: () => wrap("[code]", "[/code]") },
  ];

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1 border border-border/50 bg-card/50 p-1.5">
        {tools.map(({ icon: Icon, title, action }) => (
          <Button key={title} type="button" variant="ghost" size="icon"
            onClick={action} title={title}
            className="h-7 w-7 rounded-none hover:bg-primary/20 hover:text-primary text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}

        {/* Color picker */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Text color"
              className="h-7 w-7 rounded-none hover:bg-primary/20 hover:text-primary text-muted-foreground">
              <Palette className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2 rounded-none border-border/50 bg-card">
            <div className="grid grid-cols-5 gap-1">
              {COLORS.map(c => (
                <button key={c.name} type="button"
                  onClick={() => { wrap(`[color=${c.name}]`, "[/color]"); setColorOpen(false); }}
                  className="w-7 h-7 rounded border border-border/30 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.hex }} title={c.name} />
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <Input placeholder="#hex" className="h-6 text-xs font-mono rounded-none"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) { wrap(`[color=${v}]`, "[/color]"); setColorOpen(false); }
                  }
                }} />
            </div>
          </PopoverContent>
        </Popover>

        {/* Font size */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Font size"
              className="h-7 w-7 rounded-none hover:bg-primary/20 hover:text-primary text-muted-foreground">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-2 rounded-none border-border/50 bg-card">
            <div className="grid grid-cols-3 gap-1">
              {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(s => (
                <Button key={s} type="button" variant="ghost" size="sm"
                  onClick={() => wrap(`[size=${s}]`, "[/size]")}
                  className="h-7 rounded-none font-mono text-xs hover:bg-primary/20">
                  {s}px
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px bg-border/40 mx-0.5 self-stretch" />

        {/* Image URL */}
        <Popover open={imgOpen} onOpenChange={setImgOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Embed image"
              className="h-7 w-7 rounded-none hover:bg-primary/20 hover:text-primary text-muted-foreground">
              <Image className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 rounded-none border-border/50 bg-card space-y-2">
            <p className="font-mono text-xs uppercase text-muted-foreground">Image URL</p>
            <Input value={imgUrl} onChange={e => setImgUrl(e.target.value)}
              placeholder="https://i.imgur.com/..." className="font-mono rounded-none text-sm" />
            <Button type="button" size="sm" onClick={insertImg} className="w-full rounded-none font-mono text-xs uppercase">
              Insert Image
            </Button>
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Hyperlink"
              className="h-7 w-7 rounded-none hover:bg-primary/20 hover:text-primary text-muted-foreground">
              <Link className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 rounded-none border-border/50 bg-card space-y-2">
            <p className="font-mono text-xs uppercase text-muted-foreground">Insert Link</p>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..." className="font-mono rounded-none text-sm" />
            <Input value={linkText} onChange={e => setLinkText(e.target.value)}
              placeholder="Link text (optional)" className="font-mono rounded-none text-sm" />
            <Button type="button" size="sm" onClick={insertLink} className="w-full rounded-none font-mono text-xs uppercase">
              Insert Link
            </Button>
          </PopoverContent>
        </Popover>

        <div className="ml-auto">
          <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest hidden md:block pt-1 pr-1">
            [b]bold[/b] [i]italic[/i] [img]url[/img] [color=red]...[/color]
          </span>
        </div>
      </div>

      <Textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={`font-mono text-sm bg-background/50 border-border rounded-none focus-visible:ring-primary/50 ${className ?? ""}`}
      />
    </div>
  );
}
