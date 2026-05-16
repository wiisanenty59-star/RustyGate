import { useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, Plus, Send, Shield, Edit2, Calendar, MapPin, UserPlus, Heart,
  ChevronDown, ChevronRight, Circle, Hash,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type CrewMember = { userId: number; username: string; trustLevel: number; joinedAt: string };
type Crew = {
  id: number; name: string; description: string; creatorId: number; creatorUsername: string;
  roomId: number; memberCount: number; members: CrewMember[];
  meetupAt: string | null; meetupNote: string | null; createdAt: string;
};
type RoomMessage = {
  id: number; body: string; authorId: number; authorUsername: string;
  authorTrustLevel: number; createdAt: string; likeCount: number; likedByMe: boolean;
};
type LocationResult = { id: number; name: string; city: string | null; stateName: string | null };
type OnlineUser = { id: number; username: string; role: string };

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
              className="inline-flex items-center gap-1 border border-primary/50 bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-wider hover:bg-primary/20 cursor-pointer mx-0.5 px-1.5 py-0.5">
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
    queryKey: ["crews-online"],
    queryFn: () => customFetch<{ count: number; users: OnlineUser[] }>("/api/online"),
    refetchInterval: 20_000,
  });
}

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selected, setSelected] = useState<Crew | null>(null);
  const { data: user } = useGetCurrentUser();
  const { data: onlineData } = useOnlineUsers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [memberInput, setMemberInput] = useState("");
  const [crewsOpen, setCrewsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const { toast } = useToast();

  const typedUser = user as (typeof user & { trustLevel?: number }) | undefined;
  const onlineIds = new Set((onlineData?.users ?? []).map(u => u.id));

  async function reload() {
    const c = await customFetch<Crew[]>("/api/crews");
    const list = Array.isArray(c) ? c : [];
    setCrews(list);
    if (selected) {
      const updated = list.find(x => x.id === selected.id);
      if (updated) setSelected(updated);
    } else if (list.length > 0) {
      setSelected(list[0] ?? null);
    }
  }

  useEffect(() => { reload(); }, []);

  async function createCrew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const usernames = memberInput.split(/[, ]+/).map(s => s.trim()).filter(Boolean);
    const created = await customFetch<Crew>("/api/crews", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, memberUsernames: usernames }),
    });
    setOpen(false); setName(""); setDescription(""); setMemberInput("");
    setCrews(prev => [created, ...prev]);
    setSelected(created);
  }

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 118px)", overflow: "hidden",
      borderRadius: 6, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      background: "#1a2233",
    }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 230, flexShrink: 0,
        background: "linear-gradient(180deg, #1a2233 0%, #141c2b 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Users size={14} style={{ color: "#e8760a" }} />
            <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>Crews</span>
          </div>
          {typedUser && (typedUser.trustLevel ?? 0) >= 2 && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "3px 7px", cursor: "pointer", color: "#9aafc8", display: "flex", alignItems: "center" }}>
                  <Plus size={12} />
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-border/50 bg-card max-w-md">
                <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase">Form a Crew</DialogTitle></DialogHeader>
                <form onSubmit={createCrew} className="space-y-3">
                  <Input placeholder="Crew name" value={name} onChange={e => setName(e.target.value)} className="font-mono rounded-none" required />
                  <Textarea placeholder="Mission briefing" value={description} onChange={e => setDescription(e.target.value)} className="font-mono rounded-none" rows={2} />
                  <Input placeholder="Members (usernames, comma separated)" value={memberInput} onChange={e => setMemberInput(e.target.value)} className="font-mono rounded-none" />
                  <DialogFooter><Button type="submit" className="font-serif tracking-widest uppercase rounded-none">Form Crew</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Crew list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <button onClick={() => setCrewsOpen(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: 4 }}>
            {crewsOpen ? <ChevronDown size={10} color="#6b7fa0" /> : <ChevronRight size={10} color="#6b7fa0" />}
            <span style={{ color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>Your Crews</span>
          </button>

          {crewsOpen && crews.length === 0 && (
            <div style={{ padding: "4px 14px", color: "#3a4a62", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>No crews yet</div>
          )}
          {crewsOpen && crews.map(c => (
            <SidebarItem
              key={c.id}
              label={c.name}
              sub={`${c.memberCount} members`}
              active={selected?.id === c.id}
              onClick={() => setSelected(c)}
            />
          ))}

          {/* Online members of selected crew */}
          {selected && (
            <>
              <button onClick={() => setMembersOpen(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 10px 4px", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                {membersOpen ? <ChevronDown size={10} color="#6b7fa0" /> : <ChevronRight size={10} color="#6b7fa0" />}
                <span style={{ color: "#6b7fa0", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>
                  Members — {selected.memberCount}
                </span>
              </button>
              {membersOpen && selected.members.map(m => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 12px" }}>
                  <Circle size={7} style={{
                    fill: onlineIds.has(m.userId) ? "#2baa4b" : "#3a4a62",
                    color: onlineIds.has(m.userId) ? "#2baa4b" : "#3a4a62",
                    flexShrink: 0,
                  }} />
                  <span style={{
                    color: m.userId === selected.creatorId ? "#e8760a" : onlineIds.has(m.userId) ? "#9aafc8" : "#4a5a72",
                    fontSize: 12, fontFamily: "system-ui, sans-serif", fontWeight: m.userId === selected.creatorId ? 600 : 400,
                  }}>
                    {m.username}
                  </span>
                  {m.userId === selected.creatorId && <Shield size={9} style={{ color: "#e8760a" }} />}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#212d3f" }}>
        {selected ? (
          <CrewDetail crew={selected} currentUserId={user?.id} onUpdate={reload} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5a72", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
            {crews.length === 0 ? "Form or join a crew to start" : "Select a crew"}
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ label, sub, active, onClick }: { label: string; sub?: string; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", background: active ? "rgba(255,255,255,0.1)" : hov ? "rgba(255,255,255,0.05)" : "none",
        border: "none", cursor: "pointer",
        borderLeft: active ? "2px solid #e8760a" : "2px solid transparent",
        padding: "5px 12px 5px 10px", textAlign: "left",
      }}
    >
      <div style={{ color: active ? "#d8e8f8" : "#9aafc8", fontSize: 13, fontFamily: "system-ui, sans-serif", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      {sub && <div style={{ color: "#4a5a72", fontSize: 10, fontFamily: "system-ui, sans-serif", marginTop: 1 }}>{sub}</div>}
    </button>
  );
}

function CrewDetail({ crew, currentUserId, onUpdate }: { crew: Crew; currentUserId: number | undefined; onUpdate: () => void }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [body, setBody] = useState(""); const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isCreator = currentUserId === crew.creatorId;
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(crew.name); const [editDesc, setEditDesc] = useState(crew.description);
  const [editMeetupAt, setEditMeetupAt] = useState(crew.meetupAt ? crew.meetupAt.slice(0, 16) : "");
  const [editMeetupNote, setEditMeetupNote] = useState(crew.meetupNote ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [addOpen, setAddOpen] = useState(false); const [newMember, setNewMember] = useState(""); const [addingMember, setAddingMember] = useState(false);

  const [locationQuery, setLocationQuery] = useState(""); const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [showLocations, setShowLocations] = useState(false);

  useEffect(() => {
    setMessages([]); lastIdRef.current = 0;
    let cancelled = false;
    async function poll() {
      try {
        const url = lastIdRef.current > 0 ? `/api/crews/${crew.id}/messages?sinceId=${lastIdRef.current}` : `/api/crews/${crew.id}/messages`;
        const res = await customFetch<{ messages: RoomMessage[] }>(url);
        if (cancelled) return;
        if (res.messages.length > 0) {
          setMessages(prev => { const merged = lastIdRef.current === 0 ? res.messages : [...prev, ...res.messages]; lastIdRef.current = Math.max(...merged.map(m => m.id)); return merged; });
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [crew.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length]);

  useEffect(() => {
    if (!locationQuery) { setLocationResults([]); return; }
    const t = setTimeout(async () => {
      try { const res = await customFetch<LocationResult[]>(`/api/chat/location-search?q=${encodeURIComponent(locationQuery)}`); setLocationResults(Array.isArray(res) ? res : []); }
      catch { setLocationResults([]); }
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
      const msg = await customFetch<RoomMessage>(`/api/crews/${crew.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      setBody("");
      setMessages(prev => { const merged = [...prev, msg]; lastIdRef.current = Math.max(...merged.map(m => m.id)); return merged; });
    } finally { setSending(false); }
  }

  async function toggleLike(msgId: number) {
    try {
      const res = await customFetch<{ liked: boolean; count: number }>(`/api/crews/${crew.id}/messages/${msgId}/like`, { method: "POST" });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likedByMe: res.liked, likeCount: res.count } : m));
    } catch {}
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingEdit(true);
    try {
      await customFetch(`/api/crews/${crew.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, description: editDesc, meetupAt: editMeetupAt ? new Date(editMeetupAt).toISOString() : null, meetupNote: editMeetupNote || null }) });
      setEditOpen(false); onUpdate(); toast({ title: "Crew updated" });
    } catch { toast({ title: "Error", variant: "destructive" }); } finally { setSavingEdit(false); }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newMember.trim()) return; setAddingMember(true);
    try {
      await customFetch(`/api/crews/${crew.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: newMember.trim() }) });
      setNewMember(""); setAddOpen(false); onUpdate(); toast({ title: "Member added" });
    } catch { toast({ title: "Error", description: "Check the username.", variant: "destructive" }); } finally { setAddingMember(false); }
  };

  return (
    <>
      {/* Channel header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} style={{ color: "#6b7fa0" }} />
          <span style={{ color: "#d8e8f8", fontWeight: 600, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>{crew.name}</span>
          {crew.description && (
            <>
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}>|</span>
              <span style={{ color: "#6b7fa0", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{crew.description}</span>
            </>
          )}
        </div>
        {isCreator && (
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" onClick={() => { setEditName(crew.name); setEditDesc(crew.description); setEditMeetupAt(crew.meetupAt ? crew.meetupAt.slice(0, 16) : ""); setEditMeetupNote(crew.meetupNote ?? ""); setEditOpen(true); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: "#9aafc8" }}>
              <Edit2 size={12} />
            </button>
            <button type="button" onClick={() => setAddOpen(true)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: "#9aafc8" }}>
              <UserPlus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Meetup banner */}
      {crew.meetupAt && (
        <div style={{ padding: "8px 16px", background: "rgba(232,118,10,0.1)", borderBottom: "1px solid rgba(232,118,10,0.2)", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Calendar size={13} style={{ color: "#e8760a", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ color: "#e8760a", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
              Next Meetup: {format(new Date(crew.meetupAt), "EEEE, MMM d yyyy 'at' h:mm a")}
            </div>
            {crew.meetupNote && <div style={{ color: "#9aafc8", fontSize: 11, fontFamily: "system-ui, sans-serif", marginTop: 2 }}>{crew.meetupNote}</div>}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#4a5a72", fontFamily: "system-ui, sans-serif", fontSize: 13, paddingTop: 40 }}>
            Crew channel is silent. Start the planning.
          </div>
        ) : messages.map((m, i) => {
          const mine = currentUserId === m.authorId;
          const prevMsg = messages[i - 1];
          const grouped = prevMsg?.authorId === m.authorId && (new Date(m.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
          return (
            <CrewMessageRow key={m.id} msg={m} mine={mine} grouped={grouped} onLike={() => toggleLike(m.id)} />
          );
        })}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
        {showLocations && (
          <div style={{ position: "absolute", bottom: "100%", left: 16, right: 16, marginBottom: 4, background: "#1a2233", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, maxHeight: 180, overflowY: "auto", zIndex: 50, boxShadow: "0 -4px 12px rgba(0,0,0,0.3)" }}>
            {locationResults.length === 0 ? (
              <div style={{ padding: "8px 12px", color: "#6b7fa0", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{locationQuery ? "No locations found…" : "Type to search…"}</div>
            ) : locationResults.map(loc => (
              <button key={loc.id} type="button" onClick={() => pickLocation(loc)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={12} style={{ color: "#e8760a", flexShrink: 0 }} />
                <div>
                  <div style={{ color: "#d8e8f8", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>{loc.name}</div>
                  {(loc.city || loc.stateName) && <div style={{ color: "#6b7fa0", fontSize: 10 }}>{[loc.city, loc.stateName].filter(Boolean).join(", ")}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, display: "flex", alignItems: "center", padding: "0 10px" }}>
            <input
              value={body}
              onChange={e => handleBodyChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setShowLocations(false); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
              placeholder={`Message ${crew.name}… (# to tag a location)`}
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#d8e8f8", fontSize: 13, fontFamily: "system-ui, sans-serif", padding: "9px 0" }}
            />
          </div>
          <button type="submit" disabled={sending || !body.trim()}
            style={{ background: body.trim() ? "#e8760a" : "#2a3a50", border: "none", borderRadius: 4, padding: "8px 14px", cursor: body.trim() ? "pointer" : "default", color: body.trim() ? "white" : "#4a5a72", display: "flex", alignItems: "center" }}>
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-lg">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase">Edit Crew</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1"><label className="font-mono text-xs uppercase text-muted-foreground">Name</label><Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-none font-mono" required /></div>
            <div className="space-y-1"><label className="font-mono text-xs uppercase text-muted-foreground">Mission Briefing</label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="rounded-none font-mono" rows={2} /></div>
            <div className="border-t border-border/50 pt-4 space-y-3">
              <div className="space-y-1"><label className="font-mono text-xs uppercase text-muted-foreground">Meetup Date & Time</label><Input type="datetime-local" value={editMeetupAt} onChange={e => setEditMeetupAt(e.target.value)} className="rounded-none font-mono" /></div>
              <div className="space-y-1"><label className="font-mono text-xs uppercase text-muted-foreground">Meetup Notes</label><Textarea value={editMeetupNote} onChange={e => setEditMeetupNote(e.target.value)} className="rounded-none font-mono" rows={2} placeholder="Where and what to bring…" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} className="rounded-none font-mono">Cancel</Button>
              <Button type="submit" disabled={savingEdit} className="rounded-none font-serif tracking-widest uppercase">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-sm">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase">Add Member</DialogTitle></DialogHeader>
          <form onSubmit={addMember} className="space-y-3">
            <Input value={newMember} onChange={e => setNewMember(e.target.value)} className="rounded-none font-mono" placeholder="Username…" required />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} className="rounded-none font-mono">Cancel</Button>
              <Button type="submit" disabled={addingMember} className="rounded-none font-serif tracking-widest uppercase">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CrewMessageRow({ msg, mine, grouped, onLike }: { msg: RoomMessage; mine: boolean; grouped: boolean; onLike: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", gap: 10, padding: "2px 8px", borderRadius: 4, background: hov ? "rgba(255,255,255,0.03)" : "transparent", marginTop: grouped ? 0 : 8 }}>
      <div style={{ width: 32, flexShrink: 0, paddingTop: grouped ? 0 : 2 }}>
        {!grouped && (
          <div style={{ width: 28, height: 28, borderRadius: 4, background: mine ? "#1e3a5a" : "#2a3a50", display: "flex", alignItems: "center", justifyContent: "center", color: mine ? "#4a90d9" : "#6b7fa0", fontSize: 12, fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>
            {msg.authorUsername[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!grouped && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
            <span style={{ color: mine ? "#4a90d9" : "#d8e8f8", fontSize: 13, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>{msg.authorUsername}</span>
            <span style={{ color: "#4a5a72", fontSize: 10, fontFamily: "system-ui, sans-serif" }}>
              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
            </span>
          </div>
        )}
        <div style={{ color: "#a8bcd4", fontSize: 13, fontFamily: "system-ui, sans-serif", lineHeight: 1.5, wordBreak: "break-word" }}>
          {renderBody(msg.body)}
        </div>
      </div>
      {hov && (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <button type="button" onClick={onLike} style={{ background: msg.likedByMe ? "rgba(220,50,50,0.15)" : "rgba(255,255,255,0.05)", border: msg.likedByMe ? "1px solid rgba(220,50,50,0.4)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 3, cursor: "pointer", padding: "2px 6px", display: "flex", alignItems: "center", gap: 3, color: msg.likedByMe ? "#e05050" : "#6b7fa0" }}>
            <Heart size={10} style={{ fill: msg.likedByMe ? "#e05050" : "none" }} />
            {msg.likeCount > 0 && <span style={{ fontSize: 10 }}>{msg.likeCount}</span>}
          </button>
        </div>
      )}
    </div>
  );
}
