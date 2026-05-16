import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Megaphone, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Announcement = {
  id: number;
  title: string;
  body: string;
  kind: "info" | "warning" | "alert";
  priority: number;
  createdByUsername: string;
  createdAt: string;
};

const ICONS: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  alert: Megaphone,
};

const COLORS: Record<string, string> = {
  info: "border-primary/40 bg-primary/5 text-primary",
  warning: "border-accent/40 bg-accent/5 text-accent",
  alert: "border-destructive/40 bg-destructive/5 text-destructive",
};

export function AnnouncementsBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    customFetch<Announcement[]>("/api/announcements", { method: "GET" })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((a) => {
        const Icon = ICONS[a.kind] ?? Info;
        return (
          <div
            key={a.id}
            className={cn(
              "border rounded-none p-4 flex gap-3 backdrop-blur-sm",
              COLORS[a.kind] ?? COLORS.info,
            )}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-base uppercase tracking-widest mb-1">
                {a.title}
              </div>
              <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                {a.body}
              </p>
              <div className="font-mono text-[10px] uppercase tracking-wider mt-2 opacity-70">
                Posted by {a.createdByUsername}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
