import { useState } from "react";
import { useListCategories, useListStates, useGetForumStats, useGetRecentActivity, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, MapPin, Users, FileText, Circle, ChevronDown, ChevronRight, Layers, Globe, Clock, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const RUST = "#c85a1a";
const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

type OnlineUser = { id: number; username: string; role: string; trustLevel: number };
type Crew = { id: number; name: string; memberCount: number };

function useOnlineUsers() {
  return useQuery({
    queryKey: ["online-users"],
    queryFn: () => customFetch<{ count: number; users: OnlineUser[] }>("/api/online"),
    refetchInterval: 30_000,
  });
}
function useCrewsList() {
  return useQuery({
    queryKey: ["crews-sidebar"],
    queryFn: () => customFetch<Crew[]>("/api/crews"),
    refetchInterval: 60_000,
  });
}

type Category = {
  id: number; name: string; slug: string; description?: string;
  parentId?: number | null; threadCount: number; postCount: number;
  latestThread?: { title: string; lastActivityAt: string } | null;
};
type State = { id: number; name: string; slug: string; abbreviation: string; locationCount: number; threadCount: number };

/* ── Sidebar panel ── */
function Panel({ title, icon, children, href }: { title: string; icon: React.ReactNode; children: React.ReactNode; href?: string }) {
  return (
    <div style={{ marginBottom: 10, borderRadius: 6, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{
        background: "linear-gradient(135deg, #1a2a3e 0%, #0f1924 100%)",
        padding: "7px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#c8d8e8", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", fontFamily: FONT, textTransform: "uppercase" as const }}>
          {icon}{title}
        </div>
        {href && (
          <Link href={href} style={{ color: RUST, fontSize: 10, textDecoration: "none", fontFamily: FONT }}>View all →</Link>
        )}
      </div>
      <div style={{ background: "#0f1824", borderTop: "none" }}>
        {children}
      </div>
    </div>
  );
}

function SidebarRow({ children, href, muted }: { children: React.ReactNode; href?: string; muted?: boolean }) {
  const [hov, setHov] = useState(false);
  const inner = (
    <div
      style={{
        padding: "5px 12px", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hov ? "rgba(200,90,26,0.08)" : "transparent",
        transition: "background 0.1s", fontFamily: FONT,
        color: muted ? "#2a3a50" : "#8aaac8",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: "none", display: "block" }}>{inner}</Link>;
  return inner;
}

/* ── Category group ── */
function CategoryGroup({ cat, subCats }: { cat: Category; subCats: Category[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 6, borderRadius: 6, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          background: open ? "linear-gradient(135deg, #1e2e44 0%, #131e2e 100%)" : "linear-gradient(135deg, #141e2e 0%, #0f1824 100%)",
          color: "#c8d8e8", padding: "9px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "none", cursor: "pointer", fontFamily: FONT,
          borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" }}>
          {open ? <ChevronDown size={14} style={{ color: RUST }} /> : <ChevronRight size={14} style={{ color: RUST }} />}
          <Layers size={13} style={{ color: RUST, opacity: 0.8 }} />
          {cat.name}
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 10, color: "#3a5070", letterSpacing: "0.08em", fontWeight: 600 }}>
          <span>POSTS</span>
          <span>THREADS</span>
          <span style={{ minWidth: 100, textAlign: "right" }}>LAST POST</span>
        </div>
      </button>
      {open && (
        <div style={{ background: "#0c1520" }}>
          <ForumRow cat={cat} isMain />
          {subCats.map(sub => <ForumRow key={sub.id} cat={sub} />)}
        </div>
      )}
    </div>
  );
}

function ForumRow({ cat, isMain }: { cat: Category; isMain?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        background: hov ? "#141e2e" : (isMain ? "#111a28" : "#0e1822"),
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", padding: "10px 14px", gap: 12,
        transition: "background 0.15s",
        paddingLeft: isMain ? 14 : 30,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Icon */}
      <div style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 6,
        background: isMain
          ? `linear-gradient(135deg, ${RUST} 0%, #8a2800 100%)`
          : "linear-gradient(135deg, #1e3a5a 0%, #0f2438 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: isMain ? `0 2px 8px rgba(200,90,26,0.35)` : "0 2px 6px rgba(0,0,0,0.4)",
      }}>
        <MessageSquare size={14} color="white" />
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/category/${cat.slug}`} style={{
          color: hov ? "#f0e0d0" : "#c0d0e0",
          fontWeight: 700, fontSize: 13, textDecoration: "none",
          fontFamily: FONT, letterSpacing: "0.01em",
        }}>
          {cat.name}
        </Link>
        {cat.description && (
          <div style={{ color: "#3a5068", fontSize: 11, marginTop: 2, fontFamily: FONT }}>{cat.description}</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, justifyContent: "flex-end", minWidth: 240 }}>
        <div style={{ textAlign: "center", minWidth: 48 }}>
          <div style={{ fontWeight: 700, color: "#d0e0f0", fontSize: 14, fontFamily: FONT }}>{cat.postCount.toLocaleString()}</div>
          <div style={{ color: "#2a3a50", fontSize: 10, letterSpacing: "0.05em", fontFamily: FONT }}>posts</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 48 }}>
          <div style={{ fontWeight: 700, color: "#d0e0f0", fontSize: 14, fontFamily: FONT }}>{cat.threadCount.toLocaleString()}</div>
          <div style={{ color: "#2a3a50", fontSize: 10, letterSpacing: "0.05em", fontFamily: FONT }}>threads</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 120 }}>
          {cat.latestThread ? (
            <div>
              <div style={{ fontSize: 11, color: "#c85a1a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120, fontFamily: FONT }}>
                {cat.latestThread.title}
              </div>
              <div style={{ fontSize: 10, color: "#2a3a50", marginTop: 1, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", fontFamily: FONT }}>
                <Clock size={9} />
                {formatDistanceToNow(new Date(cat.latestThread.lastActivityAt), { addSuffix: true })}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "#1a2a3a", fontStyle: "italic", fontFamily: FONT }}>No posts yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: categories, isLoading: loadingCats } = useListCategories();
  const { data: states, isLoading: loadingStates } = useListStates();
  const { data: stats, isLoading: loadingStats } = useGetForumStats();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity();
  const { data: onlineData, isLoading: loadingOnline } = useOnlineUsers();
  const { data: crews, isLoading: loadingCrews } = useCrewsList();

  const topCategories: Category[] = (categories ?? []).filter((c: Category) => !c.parentId);
  const subCategories: Category[] = (categories ?? []).filter((c: Category) => !!c.parentId);

  return (
    <div>
      {/* ── Hero Banner ── */}
      <div style={{
        position: "relative",
        marginBottom: 14,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(200,90,26,0.2)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
      }}>
        {/* Background layers */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, #050a10 0%, #0a1520 40%, #111824 70%, #0d1018 100%)",
        }} />
        {/* Rust glow blob left */}
        <div style={{
          position: "absolute", top: -40, left: -40, width: 280, height: 180,
          background: "radial-gradient(ellipse, rgba(200,90,26,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Rust glow blob right */}
        <div style={{
          position: "absolute", bottom: -30, right: -20, width: 220, height: 150,
          background: "radial-gradient(ellipse, rgba(200,60,10,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Grid pattern overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        {/* Banner content */}
        <div style={{ position: "relative", padding: "32px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 20 }}>
            <div>
              {/* Eyebrow tag */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(200,90,26,0.15)", border: "1px solid rgba(200,90,26,0.3)",
                borderRadius: 3, padding: "3px 10px", marginBottom: 12,
              }}>
                <Circle size={6} style={{ fill: RUST, color: RUST }} />
                <span style={{ color: RUST, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", fontFamily: FONT, textTransform: "uppercase" as const }}>
                  Invite Only · Underground · Opsec First
                </span>
              </div>

              {/* Main title */}
              <div style={{
                fontSize: 48, fontWeight: 900, fontFamily: FONT,
                letterSpacing: "0.06em", lineHeight: 1,
                color: "transparent",
                background: `linear-gradient(135deg, #f0e8dc 0%, #d8c8b0 40%, ${RUST} 80%, #8a2800 100%)`,
                WebkitBackgroundClip: "text", backgroundClip: "text",
                textShadow: "none",
                marginBottom: 8,
              }}>
                RUSTYGATE
              </div>

              {/* Tagline */}
              <div style={{
                fontSize: 14, color: "#4a6080", fontFamily: FONT,
                letterSpacing: "0.08em", textTransform: "uppercase" as const,
                fontWeight: 500,
              }}>
                Breach the forgotten. Document the abandoned.
              </div>
            </div>

            {/* Stats cluster */}
            {!loadingStats && stats && (
              <div style={{ display: "flex", gap: 2 }}>
                {[
                  { icon: <Users size={16} />, val: stats.memberCount, label: "Operatives", color: "#4a8abc" },
                  { icon: <MapPin size={16} />, val: stats.locationCount, label: "Locations", color: RUST },
                  { icon: <FileText size={16} />, val: stats.threadCount, label: "Threads", color: "#4a9a5a" },
                  { icon: <MessageSquare size={16} />, val: stats.postCount, label: "Posts", color: "#8a5abc" },
                ].map((s, i) => (
                  <div key={i} style={{
                    textAlign: "center", padding: "12px 16px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: i === 0 ? "6px 0 0 6px" : i === 3 ? "0 6px 6px 0" : 0,
                  }}>
                    <div style={{ color: s.color, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#d8e8f4", fontFamily: FONT }}>{s.val.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: "#2a3a50", letterSpacing: "0.1em", fontFamily: FONT, textTransform: "uppercase" as const, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom accent line */}
          <div style={{ marginTop: 20, height: 1, background: "linear-gradient(90deg, transparent, rgba(200,90,26,0.4), transparent)" }} />

          {stats?.newestMember && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#2a3a50", fontFamily: FONT, display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={10} style={{ color: "#3a5a70" }} />
              Newest operative:
              <span style={{ color: RUST, fontWeight: 600 }}>{stats.newestMember}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

        {/* ── Main column ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Categories */}
          <div style={{ marginBottom: 12 }}>
            {loadingCats ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
              </div>
            ) : topCategories.length === 0 ? (
              <div style={{
                background: "#0f1824", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6, padding: "24px 18px", textAlign: "center",
                fontSize: 12, color: "#2a3a50", fontFamily: FONT,
              }}>
                No categories yet — an admin can create them from the Admin Panel.
              </div>
            ) : (
              topCategories.map(cat => (
                <CategoryGroup key={cat.id} cat={cat} subCats={subCategories.filter(s => s.parentId === cat.id)} />
              ))
            )}
          </div>

          {/* Geographic Sectors */}
          <div style={{ borderRadius: 6, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
            <div style={{
              background: "linear-gradient(135deg, #1a2a3e 0%, #0f1924 100%)",
              padding: "8px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#c8d8e8", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", fontFamily: FONT, textTransform: "uppercase" as const }}>
                <Globe size={13} style={{ color: RUST }} />
                Geographic Sectors
              </div>
              <Link href="/sectors" style={{ color: RUST, fontSize: 10, textDecoration: "none", fontFamily: FONT }}>Browse all →</Link>
            </div>
            <div style={{ background: "#0c1520", padding: 1 }}>
              {loadingStates ? (
                <div style={{ padding: 12 }}><Skeleton className="h-10 w-full rounded" /></div>
              ) : (states ?? []).length === 0 ? (
                <div style={{ padding: "16px", fontSize: 11, color: "#2a3a50", fontFamily: FONT, textAlign: "center" }}>
                  No sectors mapped yet.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1, background: "rgba(255,255,255,0.03)" }}>
                  {(states as State[] ?? []).map(state => (
                    <Link key={state.id} href={`/state/${state.slug}`} style={{ textDecoration: "none" }}>
                      <StateCard state={state} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: 205, flexShrink: 0 }}>

          <Panel title="Online Now" icon={<Circle size={8} style={{ fill: "#2baa4b", color: "#2baa4b" }} />}>
            {loadingOnline ? (
              <div style={{ padding: 8 }}><Skeleton className="h-4 w-3/4" /></div>
            ) : !onlineData?.users?.length ? (
              <SidebarRow muted>No members online.</SidebarRow>
            ) : onlineData.users.map(u => (
              <SidebarRow key={u.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Circle size={7} style={{ fill: "#2baa4b", color: "#2baa4b", flexShrink: 0 }} />
                  <span style={{ color: u.role === "admin" ? "#f0a060" : "#8aaac8", fontWeight: u.role === "admin" ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.username}
                  </span>
                  {u.role === "admin" && (
                    <span style={{ marginLeft: "auto", fontSize: 9, background: RUST, color: "white", padding: "1px 4px", borderRadius: 2, flexShrink: 0 }}>ADM</span>
                  )}
                </div>
              </SidebarRow>
            ))}
            <div style={{ padding: "5px 12px", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "#2a3a50", fontFamily: FONT }}>
              {onlineData?.count ?? 0} member{(onlineData?.count ?? 0) !== 1 ? "s" : ""} online
            </div>
          </Panel>

          <Panel title="Active Crews" icon={<Users size={11} />} href="/crews">
            {loadingCrews ? (
              <div style={{ padding: 8 }}><Skeleton className="h-4 w-3/4" /></div>
            ) : !(crews ?? []).length ? (
              <SidebarRow muted>No crews yet.</SidebarRow>
            ) : (crews ?? []).slice(0, 8).map((crew: Crew) => (
              <SidebarRow key={crew.id} href="/crews">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{crew.name}</span>
                  <span style={{ color: "#2a3a50", fontSize: 10, flexShrink: 0, marginLeft: 6, display: "flex", alignItems: "center", gap: 2 }}>
                    {crew.memberCount}<Users size={9} />
                  </span>
                </div>
              </SidebarRow>
            ))}
          </Panel>

          <Panel title="Latest Posts" icon={<Clock size={11} />} href="/feed">
            {loadingActivity ? (
              <div style={{ padding: 8 }}><Skeleton className="h-4 w-full" /></div>
            ) : !(recentActivity ?? []).length ? (
              <SidebarRow muted>No recent posts.</SidebarRow>
            ) : (recentActivity ?? []).slice(0, 8).map((item, i) => (
              <SidebarRow key={i} href={`/thread/${item.threadId}`}>
                <div>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "#9aafc8" }}>
                    {item.threadTitle}
                  </div>
                  <div style={{ color: "#2a3a50", fontSize: 10, display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                    <span style={{ color: RUST, fontWeight: 600 }}>{item.actorUsername}</span>
                    · {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                  </div>
                </div>
              </SidebarRow>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StateCard({ state }: { state: State }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        background: hov ? "#141e2e" : "#0f1824",
        padding: "9px 11px", fontFamily: FONT,
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: hov ? "#f0e0d0" : "#8aaac8", fontSize: 12 }}>{state.name}</span>
        <span style={{ fontSize: 10, color: "#2a3a50", background: "rgba(255,255,255,0.05)", borderRadius: 3, padding: "1px 5px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.06)" }}>
          {state.abbreviation}
        </span>
      </div>
      <div style={{ color: "#2a3a50", fontSize: 10, marginTop: 3, display: "flex", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 2, color: hov ? RUST : "#2a3a50" }}>
          <MapPin size={9} />{state.locationCount}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <MessageSquare size={9} />{state.threadCount}
        </span>
      </div>
    </div>
  );
}
