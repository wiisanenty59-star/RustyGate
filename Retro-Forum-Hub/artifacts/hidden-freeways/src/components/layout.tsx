import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  useLogout,
  useListCategories,
  getGetCurrentUserQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  LogOut,
  PlusSquare,
  MessageSquare,
  Users,
  Mail,
  LayoutGrid,
  ChevronDown,
  User,
  Circle,
  TrendingUp,
  Globe,
} from "lucide-react";

function useOnlineCount() {
  const { data: authUser } = useGetCurrentUser();
  return useQuery({
    queryKey: ["online-count"],
    queryFn: () =>
      customFetch<{ count: number; users: { id: number; username: string }[] }>(
        "/api/online",
      ),
    refetchInterval: 30_000,
    enabled: !!authUser,
  });
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
const RUST = "#c85a1a";
const RUST_GLOW = "rgba(200,90,26,0.35)";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  const { data: categories } = useListCategories();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: onlineData } = useOnlineCount();
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetCurrentUserQueryKey(),
        });
        setLocation("/login");
      },
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node))
        setCatMenuOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const topCategories = (categories ?? []).filter(
    (c) => !(c as { parentId?: number | null }).parentId,
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d1117",
      }}
    >
      {/* ── Top accent line ── */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, #8a2800, ${RUST}, #e87820, ${RUST}, #8a2800)`,
        }}
      />

      {/* ── Header ── */}
      <div
        style={{
          background: "linear-gradient(180deg, #101820 0%, #090f17 100%)",
          borderBottom: `1px solid rgba(200,90,26,0.25)`,
          boxShadow: `0 2px 20px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Brand row */}
        <div
          style={{
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Logo badge */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: `linear-gradient(135deg, ${RUST} 0%, #8a2800 100%)`,
                  boxShadow: `0 0 18px ${RUST_GLOW}, 0 2px 8px rgba(0,0,0,0.5)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 900,
                  fontSize: 17,
                  borderRadius: 8,
                  fontFamily: FONT,
                  letterSpacing: "0.04em",
                  border: "1px solid rgba(255,150,80,0.3)",
                }}
              >
                RG
              </div>

              <div>
                <div
                  style={{
                    color: "#f0e8dc",
                    fontWeight: 800,
                    fontSize: 20,
                    fontFamily: FONT,
                    letterSpacing: "0.06em",
                    lineHeight: 1.1,
                    textShadow: `0 0 20px ${RUST_GLOW}`,
                  }}
                >
                  RUSTYGATE
                </div>
                <div
                  style={{
                    color: "#5a7090",
                    fontSize: 10,
                    fontFamily: FONT,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginTop: 1,
                  }}
                >
                  Breach the Forgotten
                </div>
              </div>
            </div>
          </Link>

          {!isLoading && user && (
            <div
              style={{ textAlign: "right", fontFamily: FONT, lineHeight: 1.6 }}
            >
              <div style={{ fontSize: 12, color: "#6b7f98" }}>
                Operative:{" "}
                <span style={{ color: "#f0a060", fontWeight: 600 }}>
                  {user.username}
                </span>
                {user.role === "admin" && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: RUST,
                      color: "white",
                      padding: "1px 7px",
                      fontSize: 10,
                      borderRadius: 3,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    ADMIN
                  </span>
                )}
              </div>
              {onlineData && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#3a5070",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  <Circle
                    size={6}
                    style={{ fill: "#2baa4b", color: "#2baa4b" }}
                  />
                  {onlineData.count} online now
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav
          style={{
            background: "rgba(0,0,0,0.3)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "stretch",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <NavItem
            href="/"
            icon={<LayoutGrid size={12} />}
            label="Forum Home"
            current={location === "/"}
          />

          <div ref={catRef} style={{ position: "relative" }}>
            <button
              onClick={() => setCatMenuOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#7a9ab8",
                fontSize: 12,
                fontFamily: FONT,
                padding: "8px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderRight: "1px solid rgba(255,255,255,0.04)",
                whiteSpace: "nowrap",
              }}
            >
              <LayoutGrid size={12} />
              Categories
              <ChevronDown size={10} />
            </button>
            {catMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 300,
                  background: "#0f1924",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderTop: `2px solid ${RUST}`,
                  minWidth: 240,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  borderRadius: "0 0 6px 6px",
                }}
              >
                {topCategories.length === 0 ? (
                  <div
                    style={{
                      padding: "10px 16px",
                      fontSize: 12,
                      color: "#4a6080",
                      fontFamily: FONT,
                    }}
                  >
                    No categories yet
                  </div>
                ) : (
                  topCategories.map(
                    (cat: {
                      id: number;
                      slug: string;
                      name: string;
                      description?: string;
                    }) => (
                      <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        onClick={() => setCatMenuOpen(false)}
                        style={{
                          display: "block",
                          padding: "9px 16px",
                          fontSize: 12,
                          color: "#9aafc8",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textDecoration: "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(200,90,26,0.15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "none")
                        }
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontFamily: FONT,
                            color: "#c8d8e8",
                          }}
                        >
                          {cat.name}
                        </div>
                        {cat.description && (
                          <div
                            style={{
                              color: "#4a6080",
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {cat.description}
                          </div>
                        )}
                      </Link>
                    ),
                  )
                )}
                <Link
                  href="/"
                  onClick={() => setCatMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "8px 16px",
                    fontSize: 12,
                    color: RUST,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontFamily: FONT,
                  }}
                >
                  View All →
                </Link>
              </div>
            )}
          </div>

          <NavItem
            href="/sectors"
            icon={<Globe size={12} />}
            label="Sectors"
            current={
              location.startsWith("/sectors") || location.startsWith("/state/")
            }
          />
          <NavItem
            href="/feed"
            icon={<TrendingUp size={12} />}
            label="Feed"
            current={location === "/feed"}
          />
          <NavItem
            href="/chat"
            icon={<MessageSquare size={12} />}
            label="Chat"
            current={location.startsWith("/chat")}
          />
          <NavItem
            href="/crews"
            icon={<Users size={12} />}
            label="Crews"
            current={location === "/crews"}
          />
          <NavItem
            href="/messages"
            icon={<Mail size={12} />}
            label="Messages"
            current={location === "/messages"}
          />
          {user && (
            <NavItem
              href="/new-thread"
              icon={<PlusSquare size={12} />}
              label="New Thread"
              current={location === "/new-thread"}
              accent
            />
          )}

          {/* User menu */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "stretch",
            }}
          >
            {!isLoading && user ? (
              <div ref={userRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#7a9ab8",
                    fontSize: 12,
                    fontFamily: FONT,
                    padding: "8px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    borderLeft: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: `rgba(200,90,26,0.2)`,
                      border: "1px solid rgba(200,90,26,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#f0a060",
                    }}
                  >
                    {user.username[0]?.toUpperCase()}
                  </div>
                  {user.username}
                  <ChevronDown size={10} />
                </button>
                {userMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      zIndex: 300,
                      background: "#0f1924",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderTop: `2px solid ${RUST}`,
                      minWidth: 190,
                      boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                      borderRadius: "0 0 6px 6px",
                    }}
                  >
                    {user.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 16px",
                          fontSize: 12,
                          color: "#f0a060",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textDecoration: "none",
                          fontFamily: FONT,
                          fontWeight: 600,
                        }}
                      >
                        <Shield size={13} />
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "10px 16px",
                        fontSize: 12,
                        color: "#e05050",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: FONT,
                        textAlign: "left",
                      }}
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : !isLoading ? (
              <Link
                href="/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  color: "#f0a060",
                  fontWeight: 600,
                  fontSize: 12,
                  textDecoration: "none",
                  fontFamily: FONT,
                  borderLeft: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                Sign In
              </Link>
            ) : null}
          </div>
        </nav>
      </div>

      {/* ── Main content ── */}
      <main
        style={{
          flex: 1,
          padding: "12px 14px",
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box" as const,
        }}
      >
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          background: "#090f17",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "8px 18px",
          fontSize: 11,
          fontFamily: FONT,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontWeight: 800,
              color: "#f0a060",
              letterSpacing: "0.06em",
              fontSize: 12,
            }}
          >
            RUSTYGATE
          </span>
          <span style={{ color: "#2a3a4a" }}>·</span>
          <span style={{ color: "#2a3a4a" }}>
            © {new Date().getFullYear()}
          </span>
          <span style={{ color: "#1a2a3a" }}>·</span>
          <span style={{ color: "#2a3a4a" }}>
            Invite-only urban exploration community
          </span>
        </div>
        {onlineData && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Circle size={7} style={{ fill: "#2baa4b", color: "#2baa4b" }} />
            <span style={{ color: "#2b7a3b", fontWeight: 600 }}>
              {onlineData.count}
            </span>
            <span style={{ color: "#2a3a4a" }}>
              member{onlineData.count !== 1 ? "s" : ""} online
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  current,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  current?: boolean;
  accent?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        color: accent
          ? "#f0a060"
          : current
            ? "#e8d8c8"
            : hovered
              ? "#c8d8e8"
              : "#6a8aa8",
        fontSize: 12,
        fontFamily: FONT,
        padding: "8px 14px",
        textDecoration: "none",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        background: current
          ? "rgba(200,90,26,0.12)"
          : hovered
            ? "rgba(255,255,255,0.03)"
            : "none",
        borderBottom: current ? `2px solid ${RUST}` : "2px solid transparent",
        whiteSpace: "nowrap",
        fontWeight: current ? 600 : 400,
        transition: "all 0.12s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      {label}
    </Link>
  );
}
