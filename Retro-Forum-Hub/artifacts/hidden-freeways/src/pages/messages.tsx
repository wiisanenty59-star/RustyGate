import { useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Plus, Send, Shield } from "lucide-react";

type ChatSummary = {
  id: number;
  otherUserId: number;
  otherUsername: string;
  otherTrustLevel: number;
  lastMessageBody: string | null;
  lastActivityAt: string;
};

type Msg = {
  id: number;
  body: string;
  authorId: number;
  authorUsername: string;
  authorTrustLevel: number;
  createdAt: string;
};

export default function MessagesPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selected, setSelected] = useState<ChatSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const { data: user } = useGetCurrentUser();

  async function reload() {
    const c = await customFetch<ChatSummary[]>("/api/messages", {
      method: "GET",
    });
    const list = Array.isArray(c) ? c : [];
    setChats(list);
    if (selected) {
      const updated = list.find((x) => x.id === selected.id);
      if (updated) setSelected(updated);
    } else if (list.length > 0) {
      setSelected(list[0] ?? null);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openChat(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    const created = await customFetch<ChatSummary>("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: target }),
    });
    setOpen(false);
    setTarget("");
    setChats((prev) =>
      prev.find((c) => c.id === created.id) ? prev : [created, ...prev],
    );
    setSelected(created);
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-primary tracking-widest uppercase flex items-center gap-3">
            <Mail className="w-6 h-6" /> Direct Lines
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-2">
            One-on-one channels. Encrypted by silence.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-serif tracking-widest uppercase rounded-none">
              <Plus className="w-4 h-4 mr-2" /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none border-border/50 bg-card">
            <DialogHeader>
              <DialogTitle className="font-serif tracking-widest uppercase">
                Open Direct Line
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={openChat} className="space-y-3">
              <Input
                placeholder="Username"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="font-mono rounded-none"
                required
              />
              <DialogFooter>
                <Button
                  type="submit"
                  className="font-serif tracking-widest uppercase rounded-none"
                >
                  Open
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <aside className="space-y-2">
          {chats.length === 0 && (
            <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider p-4 border border-border/40">
              No direct lines yet
            </div>
          )}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left border p-3 rounded-none transition-all ${
                selected?.id === c.id
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-card/30 hover:border-primary/40"
              }`}
            >
              <div className="font-serif text-sm uppercase tracking-widest text-foreground truncate flex items-center gap-2">
                {c.otherUsername}
                {c.otherTrustLevel >= 3 && (
                  <Shield className="w-3 h-3 text-accent" />
                )}
              </div>
              {c.lastMessageBody && (
                <div className="font-mono text-[11px] text-muted-foreground truncate mt-1">
                  {c.lastMessageBody}
                </div>
              )}
              <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mt-1">
                {formatDistanceToNow(new Date(c.lastActivityAt), {
                  addSuffix: true,
                })}
              </div>
            </button>
          ))}
        </aside>

        {selected ? (
          <DmDetail chat={selected} currentUserId={user?.id} />
        ) : (
          <div className="text-muted-foreground font-mono text-xs uppercase tracking-wider p-12 border border-border/40 text-center">
            Select or open a chat
          </div>
        )}
      </div>
    </div>
  );
}

function DmDetail({
  chat,
  currentUserId,
}: {
  chat: ChatSummary;
  currentUserId: number | undefined;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    lastIdRef.current = 0;
    let cancelled = false;
    async function poll() {
      try {
        const url =
          lastIdRef.current > 0
            ? `/api/messages/${chat.id}?sinceId=${lastIdRef.current}`
            : `/api/messages/${chat.id}`;
        const res = await customFetch<{ messages: Msg[] }>(url, {
          method: "GET",
        });
        if (cancelled) return;
        if (res.messages.length > 0) {
          setMessages((prev) => {
            const merged =
              lastIdRef.current === 0
                ? res.messages
                : [...prev, ...res.messages];
            lastIdRef.current = Math.max(...merged.map((m) => m.id));
            return merged;
          });
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [chat.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await customFetch(`/api/messages/${chat.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-border/50 bg-card/30 backdrop-blur-sm flex flex-col">
      <div className="border-b border-border/50 p-4">
        <div className="font-serif text-xl uppercase tracking-widest text-foreground flex items-center gap-2">
          {chat.otherUsername}
          {chat.otherTrustLevel >= 3 && (
            <Shield className="w-4 h-4 text-accent" />
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[55vh] overflow-y-auto p-4 space-y-3 bg-background/30"
      >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground font-mono text-xs uppercase tracking-wider py-12">
            No messages yet
          </div>
        ) : (
          messages.map((m) => {
            const mine = currentUserId === m.authorId;
            return (
              <div
                key={m.id}
                className={`max-w-[80%] ${mine ? "ml-auto" : ""}`}
              >
                <div
                  className={`border p-3 ${
                    mine
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-card/40"
                  }`}
                >
                  <div className="font-mono text-sm text-foreground whitespace-pre-wrap">
                    {m.body}
                  </div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-1 px-1">
                  {formatDistanceToNow(new Date(m.createdAt), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 p-3 border-t border-border/50">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Direct transmit..."
          className="font-mono rounded-none"
        />
        <Button
          type="submit"
          disabled={sending || !body.trim()}
          className="font-serif tracking-widest uppercase rounded-none"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
