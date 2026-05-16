import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Send, Hash, Lock, Shield, Heart, UserX, MapPin, Users, Radio, ChevronDown, ChevronRight, Circle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatRoom = {
  id: number; slug: string; name: string; description: string;
  kind: string; minTrustLevel: number; memberCount: number;
  lastMessageAt: string | null;
};
type CrewRoom = { id: number; name: string; roomId: number };
type OnlineUser = { id: number; username: string; role: string; trustLevel?: number };
type RoomMessage = {
  id: number; body: string; authorId: number; authorUsername: string;
  authorTrustLevel: number; createdAt: string; likeCount: number; likedByMe: boolean;
};
type LocationResult = { id: number; name: string; city: string | null; stateName: string | null };

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBody(body: string) {
  const parts = body.split(/(\[loc:\d+:[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[loc:(\d+):([^\]]+)\]$/);
        if (m) {
          const href = `/location/${m[1]}`;
          return (
            <a key={i} href={href} onClick={e => { e.preventDefault(); window.location.href = href; }}
              className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-wider hover:bg-primary/20 cursor-pointer mx-0.5 px-1.5 py-0.5">
              <MapPin className="w-2.5 h-2.5" />{m[2]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function useOnlineUsers() {
  return useQuery({
    queryKey: ["chat-online"],
    queryFn: () => customFetch<{ count: number; users: OnlineUser[] }>("/api/online"),
    refetchInterval: 20_000,
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams<{ slug?: string }>();
  const [, navigate] = useLocation();
  const { data: user } = useGetCurrentUser();
  const typedUser = user as (typeof user & { role?: string; trustLevel?: number }) | undefined;
  const isPrivileged = (typedUser?.role as string) === "admin" || (typedUser?.role as string) === "moderator";

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [crews, setCrews] = useState<CrewRoom[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>(params.slug ?? "");
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [crewsOpen, setCrewsOpen] = useState(true);

  const { data: onlineData } = useOnlineUsers();

  useEffect(() => {
    customFetch<ChatRoom[]>("/api/chat/rooms")
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setRooms(list);
        if (!activeSlug && list.length > 0) setActiveSlug(list[0]!.slug);
      });
    customFetch<{ id: number; name: string; roomId: number }[]>("/api/crews")
      .then(d => setCrews(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (params.slug) setActiveSlug(params.slug);
  }, [params.slug]);

  const activeRoom = rooms.find(r => r.slug === activeSlug);

  const switchRoom = (slug: string) => {
    setActiveSlug(slug);
    navigate(`/chat/${slug}`);
  };

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 118px)", overflow: "hidden",
      borderRadius: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      background: "#1a2233",
    }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: 230, flexShrink: 0,
        background: "linear-gradient(180deg, #1a2233 0%, #141c2b 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>

        {/* Sidebar header */}
        <div style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <Radio size={14} style={{ color: "#e8760a" }} />
          <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 13, fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
            Live Chat
          </span>
        </div>

        {/* Channels section */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <button
            onClick={() => setRoomsOpen(v => !v)}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: 4 }}
          >
            {roomsOpen ? <ChevronDown size={10} color="#6b7fa0" /> : <ChevronRight size={10} color="#6b7fa0" />}
            <span style={{ color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>
              Channels
            </span>
          </button>

          {roomsOpen && rooms.map(room => (
            <ChannelItem
              key={room.slug}
              icon={room.minTrustLevel > 0 ? <Lock size={12} /> : <Hash size={12} />}
              label={room.name}
              active={room.slug === activeSlug}
              onClick={() => switchRoom(room.slug)}
            />
          ))}

          {/* Crew rooms */}
          {crews.length > 0 && (
            <>
              <button
                onClick={() => setCrewsOpen(v => !v)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}
              >
                {crewsOpen ? <ChevronDown size={10} color="#6b7fa0" /> : <ChevronRight size={10} color="#6b7fa0" />}
                <span style={{ color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>
                  Your Crews
                </span>
              </button>
              {crewsOpen && crews.map(crew => (
                <ChannelItem
                  key={crew.id}
                  icon={<Users size={12} />}
                  label={crew.name}
                  active={false}
                  onClick={() => navigate("/crews")}
                  muted
                />
              ))}
            </>
          )}
        </div>

        {/* Online members */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "8px 0" }}>
          <div style={{ padding: "4px 12px 6px", color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>
            Online — {onlineData?.count ?? 0}
          </div>
          {(onlineData?.users ?? []).map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 12px" }}>
              <Circle size={7} style={{ fill: "#2baa4b", color: "#2baa4b", flexShrink: 0 }} />
              <span style={{
                color: u.role === "admin" ? "#e8760a" : "#9aafc8",
                fontSize: 12, fontFamily: "system-ui, sans-serif",
                fontWeight: u.role === "admin" ? 600 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {u.username}
              </span>
              {u.role === "admin" && <Shield size={10} style={{ color: "#e8760a", flexShrink: 0 }} />}
            </div>
          ))}
          {!onlineData?.users?.length && (
            <div style={{ padding: "3px 12px", color: "#4a5a72", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
              No members online
            </div>
          )}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#212d3f" }}>
        {activeSlug && activeRoom ? (
          <ChannelChat
            slug={activeSlug}
            room={activeRoom}
            userId={user?.id}
            isPrivileged={isPrivileged}
          />
        ) : activeSlug ? (
          <ChannelChat
            slug={activeSlug}
            room={null}
            userId={user?.id}
            isPrivileged={isPrivileged}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5a72", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
            Select a channel to begin
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar channel item ───────────────────────────────────────────────────────

function ChannelItem({ icon, label, active, onClick, muted }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; muted?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", background: active ? "rgba(255,255,255,0.1)" : hov ? "rgba(255,255,255,0.05)" : "none",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 12px 4px 10px",
        borderLeft: active ? "2px solid #e8760a" : "2px solid transparent",
        transition: "all 0.1s",
      }}
    >
      <span style={{ color: active ? "#9aafc8" : "#4a5a72" }}>{icon}</span>
      <span style={{
        color: active ? "#d8e8f8" : muted ? "#4a5a72" : "#6b7fa0",
        fontSize: 13, fontFamily: "system-ui, sans-serif",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textAlign: "left",
      }}>
        {label}
      </span>
    </button>
  );
}

// ── Channel chat area ─────────────────────────────────────────────────────────

function ChannelChat({ slug, room, userId, isPrivileged }: {
  slug: string;
  room: ChatRoom | null;
  userId: number | undefined;
  isPrivileged: boolean;
}) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [showLocations, setShowLocations] = useState(false);

  // Poll messages
  useEffect(() => {
    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);

    async function poll() {
      try {
        const url = lastIdRef.current > 0
          ? `/api/chat/rooms/${slug}/messages?sinceId=${lastIdRef.current}`
          : `/api/chat/rooms/${slug}/messages`;
        const res = await customFetch<{ messages: RoomMessage[] }>(url);
        if (cancelled) return;
        if (res.messages.length > 0) {
          setMessages(prev => {
            const merged = lastIdRef.current === 0 ? res.messages : [...prev, ...res.messages];
            lastIdRef.current = Math.max(...merged.map(m => m.id));
            return merged;
          });
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [slug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Location search
  useEffect(() => {
    if (!locationQuery) { setLocationResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await customFetch<LocationResult[]>(`/api/chat/location-search?q=${encodeURIComponent(locationQuery)}`);
        setLocationResults(Array.isArray(res) ? res : []);
      } catch { setLocationResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [locationQuery]);

  function handleBodyChange(val: string) {
    setBody(val);
    const match = val.match(/#(\w*)$/);
    if (match) { setLocationQuery(match[1] ?? ""); setShowLocations(true); }
    else { setShowLocations(false); setLocationQuery(""); }
  }

  function pickLocation(loc: LocationResult) {
    setBody(b => b.replace(/#\w*$/, `[loc:${loc.id}:${loc.name}]`));
    setShowLocations(false); setLocationQuery(""); setLocationResults([]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const msg = await customFetch<RoomMessage>(`/api/chat/rooms/${slug}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setBody("");
      setMessages(prev => { const merged = [...prev, msg]; lastIdRef.current = Math.max(...merged.map(m => m.id)); return merged; });
    } finally { setSending(false); }
  }

  async function toggleLike(msgId: number) {
    try {
      const res = await customFetch<{ liked: boolean; count: number }>(`/api/chat/rooms/${slug}/messages/${msgId}/like`, { method: "POST" });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likedByMe: res.liked, likeCount: res.count } : m));
    } catch {}
  }

  async function kick(uid: number, username: string) {
    if (!confirm(`Kick ${username} for 24h?`)) return;
    try { await customFetch(`/api/chat/rooms/${slug}/kick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: uid, minutes: 1440 }) }); } catch {}
  }

  return (
    <>
      {/* Channel header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(0,0,0,0.15)",
      }}>
        <Hash size={15} style={{ color: "#6b7fa0" }} />
        <span style={{ color: "#d8e8f8", fontWeight: 600, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
          {room?.name ?? slug}
        </span>
        {room?.description && (
          <>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}>|</span>
            <span style={{ color: "#6b7fa0", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{room.description}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#4a5a72", fontFamily: "system-ui, sans-serif", fontSize: 13, paddingTop: 40 }}>
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = userId === m.authorId;
            const prevMsg = messages[i - 1];
            const groupWithPrev = prevMsg?.authorId === m.authorId &&
              (new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
            return (
              <MessageRow
                key={m.id} msg={m} mine={mine} grouped={groupWithPrev}
                isPrivileged={isPrivileged}
                onLike={() => toggleLike(m.id)}
                onKick={() => kick(m.authorId, m.authorUsername)}
              />
            );
          })
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
        {showLocations && (
          <div style={{
            position: "absolute", bottom: "100%", left: 16, right: 16, marginBottom: 4,
            background: "#1a2233", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
            maxHeight: 180, overflowY: "auto", zIndex: 50,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
          }}>
            {locationResults.length === 0 ? (
              <div style={{ padding: "8px 12px", color: "#6b7fa0", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
                {locationQuery ? "No locations found…" : "Type to search…"}
              </div>
            ) : locationResults.map(loc => (
              <button key={loc.id} type="button" onClick={() => pickLocation(loc)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={12} style={{ color: "#e8760a", flexShrink: 0 }} />
                <div>
                  <div style={{ color: "#d8e8f8", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{loc.name}</div>
                  {(loc.city || loc.stateName) && (
                    <div style={{ color: "#6b7fa0", fontSize: 10, fontFamily: "system-ui, sans-serif" }}>
                      {[loc.city, loc.stateName].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={send} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4, display: "flex", alignItems: "center", padding: "0 10px",
          }}>
            <input
              value={body}
              onChange={e => handleBodyChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setShowLocations(false); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
              placeholder={`Message #${room?.name ?? slug}… (type # to tag a location)`}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#d8e8f8", fontSize: 13, fontFamily: "system-ui, sans-serif",
                padding: "9px 0",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            style={{
              background: body.trim() ? "#e8760a" : "#2a3a50",
              border: "none", borderRadius: 4, padding: "8px 14px",
              cursor: body.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 5,
              color: body.trim() ? "white" : "#4a5a72",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            <Send size={14} />
          </button>
        </form>
        <div style={{ color: "#3a4a62", fontSize: 10, fontFamily: "system-ui, sans-serif", marginTop: 3 }}>
          Type # to tag a location · Hover messages to like or kick
        </div>
      </div>
    </>
  );
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({ msg, mine, grouped, isPrivileged, onLike, onKick }: {
  msg: RoomMessage; mine: boolean; grouped: boolean;
  isPrivileged: boolean; onLike: () => void; onKick: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", gap: 10, padding: "2px 8px",
        borderRadius: 4,
        background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        marginTop: grouped ? 0 : 8,
      }}
    >
      {/* Avatar / spacer */}
      <div style={{ width: 32, flexShrink: 0, paddingTop: grouped ? 0 : 2 }}>
        {!grouped && (
          <div style={{
            width: 28, height: 28, borderRadius: 4,
            background: mine ? "#1e3a5a" : "#2a3a50",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: mine ? "#4a90d9" : "#6b7fa0",
            fontSize: 12, fontWeight: 700, fontFamily: "system-ui, sans-serif",
          }}>
            {msg.authorUsername[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!grouped && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
            <span style={{
              color: mine ? "#4a90d9" : "#d8e8f8",
              fontSize: 13, fontWeight: 600, fontFamily: "system-ui, sans-serif",
            }}>
              {msg.authorUsername}
            </span>
            {msg.authorTrustLevel >= 3 && <Shield size={10} style={{ color: "#e8760a" }} />}
            <span style={{ color: "#4a5a72", fontSize: 10, fontFamily: "system-ui, sans-serif" }}>
              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
            </span>
          </div>
        )}
        <div style={{ color: "#a8bcd4", fontSize: 13, fontFamily: "system-ui, sans-serif", lineHeight: 1.5, wordBreak: "break-word" }}>
          {renderBody(msg.body)}
        </div>
      </div>

      {/* Actions */}
      {hov && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={onLike}
            style={{
              background: msg.likedByMe ? "rgba(220,50,50,0.15)" : "rgba(255,255,255,0.05)",
              border: msg.likedByMe ? "1px solid rgba(220,50,50,0.4)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 3, cursor: "pointer", padding: "2px 6px",
              display: "flex", alignItems: "center", gap: 3,
              color: msg.likedByMe ? "#e05050" : "#6b7fa0",
            }}>
            <Heart size={10} style={{ fill: msg.likedByMe ? "#e05050" : "none" }} />
            {msg.likeCount > 0 && <span style={{ fontSize: 10, fontFamily: "system-ui, sans-serif" }}>{msg.likeCount}</span>}
          </button>
          {isPrivileged && !( typeof window !== "undefined") && (
            <button type="button" onClick={onKick}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, cursor: "pointer", padding: "2px 6px", color: "#6b7fa0" }}>
              <UserX size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
