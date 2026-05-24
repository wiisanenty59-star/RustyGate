import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Hash, Lock, Shield, Heart, UserX, MapPin, Users, Radio, ChevronDown, ChevronRight, Circle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatRoom {
  id: number;
  slug: string;
  name: string;
  description: string;
  kind: string;
  minTrustLevel: number;
  memberCount: number;
  lastMessageAt: string | null;
}

interface CrewRoom { id: number; name: string; roomId: number }

interface OnlineUser { id: number; username: string; role: string; trustLevel?: number }

interface RoomMessage {
  id: number;
  body: string;
  authorId: number;
  authorUsername: string;
  authorTrustLevel: number;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

interface LocationResult { id: number; name: string; city: string | null; stateName: string | null }

interface PrivateChatSummary { id: number; otherUsername: string; otherTrustLevel: number; lastMessageBody?: string | null; lastActivityAt: string }

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

const textEncoder = new TextEncoder();

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64Decode(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveRoomKey(passphrase: string, roomSlug: string): Promise<CryptoKey> {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textEncoder.encode(`chat:${roomSlug}`),
      iterations: 250_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBody(key: CryptoKey, text: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(text),
  );
  return JSON.stringify({ iv: base64Encode(iv), ct: base64Encode(new Uint8Array(ciphertext)) });
}

async function decryptBody(key: CryptoKey, payload: string) {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed.iv !== "string" || typeof parsed.ct !== "string") {
      return payload;
    }
    const iv = base64Decode(parsed.iv);
    const ct = base64Decode(parsed.ct);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ct,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return payload;
  }
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
  const [dms, setDms] = useState<PrivateChatSummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>(params.slug ?? "");
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [crewsOpen, setCrewsOpen] = useState(true);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState("");
  const [dmError, setDmError] = useState<string | null>(null);
  const [createCrewOpen, setCreateCrewOpen] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [crewDescription, setCrewDescription] = useState("");
  const [crewMembers, setCrewMembers] = useState("");
  const [crewError, setCrewError] = useState<string | null>(null);

  const { data: onlineData } = useOnlineUsers();
  const prevOnlineRef = useRef<number[]>([]);
  const [joinNotifications, setJoinNotifications] = useState<string[]>([]);

  useEffect(() => {
    customFetch<ChatRoom[]>("/api/chat/rooms")
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setRooms(list);
        if (!activeSlug && list.length > 0) setActiveSlug(list[0]!.slug);
      });
    customFetch<{ id: number; name: string; roomId: number }[]>("/api/crews")
      .then(d => setCrews(Array.isArray(d) ? d : []));

    // fetch direct messages summary
    customFetch<PrivateChatSummary[]>("/api/messages")
      .then(d => setDms(Array.isArray(d) ? d : []));
  }, []);

  async function openDirectLine(e: React.FormEvent) {
    e.preventDefault();
    const target = dmTarget.trim();
    if (!target) return;
    try {
      const created = await customFetch<PrivateChatSummary>("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target }),
      });
      setDmOpen(false);
      setDmTarget("");
      setDmError(null);
      setDms(prev => prev.find(item => item.id === created.id) ? prev : [created, ...prev]);
      navigate(`/messages?open=${created.id}`);
    } catch {
      setDmError("Unable to open direct line. Check the username and try again.");
    }
  }

  async function createCrew(e: React.FormEvent) {
    e.preventDefault();
    const name = crewName.trim();
    if (!name) return;
    try {
      const usernames = crewMembers
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const created = await customFetch<CrewRoom>("/api/crews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: crewDescription, memberUsernames: usernames }),
      });
      setCreateCrewOpen(false);
      setCrewName("");
      setCrewDescription("");
      setCrewMembers("");
      setCrewError(null);
      setCrews(prev => [created, ...prev]);
      navigate("/crews");
    } catch {
      setCrewError("Unable to form crew. Verify the name and member handles.");
    }
  }

  useEffect(() => {
    if (params.slug) setActiveSlug(params.slug);
  }, [params.slug]);

  const activeRoom = rooms.find(r => r.slug === activeSlug);

  const switchRoom = (slug: string) => {
    setActiveSlug(slug);
    navigate(`/chat/${slug}`);
  };

  // detect users joining and show transient notifications
  useEffect(() => {
    const ids = (onlineData?.users ?? []).map(u => u.id);
    const prev = prevOnlineRef.current;
    const newIds = ids.filter(id => !prev.includes(id));
    if (newIds.length > 0) {
      const names = (onlineData?.users ?? []).filter(u => newIds.includes(u.id)).map(u => u.username);
      setJoinNotifications(n => [...n, ...names]);
      // clear after 5s
      setTimeout(() => setJoinNotifications([]), 5000);
    }
    prevOnlineRef.current = ids;
  }, [onlineData]);

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 118px)", overflow: "hidden",
      borderRadius: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      background: "#1a2233",
      width: "100%",
    }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0, minWidth: 220,
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

          {/* Direct messages */}
          <div style={{ padding: "8px 10px", marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Direct</div>
              <Dialog open={dmOpen} onOpenChange={setDmOpen}>
                <DialogTrigger asChild>
                  <button type="button" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 4, color: "#9aafc8", fontSize: 10, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase" }}>
                    New
                  </button>
                </DialogTrigger>
                <DialogContent className="rounded-none border-border/50 bg-card max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="font-serif tracking-widest uppercase">Open Direct Line</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={openDirectLine} className="space-y-4">
                    <Input
                      placeholder="Username"
                      value={dmTarget}
                      onChange={(e) => setDmTarget(e.target.value)}
                      className="font-mono rounded-none"
                      required
                    />
                    {dmError && <div className="text-destructive text-sm">{dmError}</div>}
                    <DialogFooter>
                      <Button type="submit" className="font-serif tracking-widest uppercase rounded-none">
                        Open
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {(dms || []).map(dm => (
              <button key={dm.id} onClick={() => navigate(`/messages?open=${dm.id}`)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", textAlign: "left", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#6b7fa0", fontSize: 12 }}>{dm.otherUsername}</span>
                <span style={{ marginLeft: "auto", color: "#4a5a72", fontSize: 11 }}>{dm.lastActivityAt ? new Date(dm.lastActivityAt).toLocaleTimeString() : ""}</span>
              </button>
            ))}
          </div>

          <div style={{ padding: "8px 10px", marginTop: 8, display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate("/crews")}
              style={{
                width: "100%",
                background: "rgba(232,118,10,0.1)",
                border: "1px solid rgba(232,118,10,0.25)",
                color: "#e8a15d",
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 11,
                textTransform: "uppercase",
                fontFamily: "system-ui, sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              Crew Ops
            </button>
            <Dialog open={createCrewOpen} onOpenChange={setCreateCrewOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "#9aafc8",
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 4,
                    fontSize: 11,
                    textTransform: "uppercase",
                    fontFamily: "system-ui, sans-serif",
                    letterSpacing: "0.08em",
                  }}
                >
                  New Crew
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-border/50 bg-card max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif tracking-widest uppercase">Form New Crew</DialogTitle>
                </DialogHeader>
                <form onSubmit={createCrew} className="space-y-4">
                  <Input
                    placeholder="Crew name"
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                    className="font-mono rounded-none"
                    required
                  />
                  <Input
                    placeholder="Mission briefing"
                    value={crewDescription}
                    onChange={(e) => setCrewDescription(e.target.value)}
                    className="font-mono rounded-none"
                  />
                  <Input
                    placeholder="Members (usernames, comma separated)"
                    value={crewMembers}
                    onChange={(e) => setCrewMembers(e.target.value)}
                    className="font-mono rounded-none"
                  />
                  {crewError && <div className="text-destructive text-sm">{crewError}</div>}
                  <DialogFooter>
                    <Button type="submit" className="font-serif tracking-widest uppercase rounded-none">
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Online members */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "8px 0" }}>
          {joinNotifications.length > 0 && (
            <div style={{ padding: "6px 12px", color: "#a8e6a1", fontSize: 12 }}>
              {joinNotifications.join(", ")} joined
            </div>
          )}
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
  const [encryptionPassphrase, setEncryptionPassphrase] = useState("");
  const [encryptionOpen, setEncryptionOpen] = useState(false);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
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
          const decrypted = await Promise.all(
            res.messages.map(async (msg) => ({
              ...msg,
              body: roomKey ? await decryptBody(roomKey, msg.body) : msg.body,
            })),
          );
          setMessages(prev => {
            const merged = lastIdRef.current === 0 ? decrypted : [...prev, ...decrypted];
            lastIdRef.current = Math.max(...merged.map((m) => m.id));
            return merged;
          });
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [slug, roomKey]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`chat-passphrase:${slug}`);
    if (!stored) return;
    deriveRoomKey(stored, slug)
      .then((key) => { setRoomKey(key); setEncryptionPassphrase(stored); })
      .catch(() => {
        setRoomKey(null);
        setEncryptionError("Unable to load stored chat passphrase.");
      });
  }, [slug]);

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
      const payload = roomKey ? await encryptBody(roomKey, body.trim()) : body.trim();
      const msg = await customFetch<RoomMessage>(`/api/chat/rooms/${slug}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: payload }),
      });
      setBody("");
      const decryptedBody = roomKey ? await decryptBody(roomKey, msg.body) : msg.body;
      setMessages(prev => {
        const merged = [...prev, { ...msg, body: decryptedBody }];
        lastIdRef.current = Math.max(...merged.map(m => m.id));
        return merged;
      });
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
    try {
      await customFetch(`/api/chat/rooms/${slug}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, minutes: 1440 }),
      });
    } catch {}
  }

  return (
    <>
      {/* Channel header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: "rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Hash size={15} style={{ color: "#6b7fa0" }} />
          <div>
            <div style={{ color: "#d8e8f8", fontWeight: 600, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
              {room?.name ?? slug}
            </div>
            {room?.description && (
              <div style={{ color: "#6b7fa0", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
                {room.description}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => setEncryptionOpen(true)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "5px 10px", color: "#9aafc8", fontSize: 11, cursor: "pointer" }}>
            {roomKey ? "Encrypted" : "Enable encryption"}
          </button>
          {roomKey && <span style={{ color: "#6b7fa0", fontSize: 11 }}>E2EE active</span>}
        </div>
      </div>

      <Dialog open={encryptionOpen} onOpenChange={setEncryptionOpen}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-widest uppercase">Room encryption</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const key = await deriveRoomKey(encryptionPassphrase, slug);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(`chat-passphrase:${slug}`, encryptionPassphrase);
                }
                setRoomKey(key);
                setEncryptionError(null);
                setEncryptionOpen(false);
              } catch {
                setEncryptionError("Unable to derive encryption key from passphrase.");
              }
            }}
            className="space-y-4"
          >
            <Input
              type="password"
              placeholder="Shared room passphrase"
              value={encryptionPassphrase}
              onChange={(e) => setEncryptionPassphrase(e.target.value)}
              className="font-mono rounded-none"
              required
            />
            {encryptionError && <div className="text-destructive text-sm">{encryptionError}</div>}
            <DialogFooter>
              <Button type="submit" className="font-serif tracking-widest uppercase rounded-none">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
      <div style={{ padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", background: "#212d3f", flexShrink: 0 }}>
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
        <form onSubmit={send} style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", minHeight: 40 }}>
          <div style={{
            flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4, display: "flex", alignItems: "center", padding: "0 10px",
            minWidth: 0,
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
                width: "100%",
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
              whiteSpace: "nowrap",
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
          {isPrivileged && (
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
