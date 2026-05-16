import { Link } from "wouter";
import { useListStates } from "@workspace/api-client-react";
import type { StateSummary } from "@workspace/api-client-react";
import { MapPin, FileText, MessageSquare, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  CA: "#e8760a", NY: "#2b6cb0", TX: "#276749", IL: "#6b46c1",
  PA: "#c53030", OH: "#d69e2e", MI: "#2c7a7b", GA: "#744210",
  NJ: "#553c9a", WA: "#285e61", FL: "#1a365d", MA: "#702459",
  AZ: "#7b341e", NV: "#2d3748", CO: "#22543d", OR: "#2a4365",
  MD: "#742a2a", MO: "#44337a", IN: "#1a202c", TN: "#3c366b",
};

export default function Sectors() {
  const { data: states, isLoading } = useListStates();

  const totalLocations = (states ?? []).reduce((sum: number, s: StateSummary) => sum + s.locationCount, 0);
  const totalThreads = (states ?? []).reduce((sum: number, s: StateSummary) => sum + s.threadCount, 0);

  return (
    <div>
      {/* Header bar */}
      <div style={{
        background: "linear-gradient(to bottom, #3a5f8a, #274a70)",
        color: "white",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        borderBottom: "2px solid #e8760a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={14} />
          <span style={{ fontFamily: "Verdana, sans-serif", fontWeight: "bold", fontSize: 13 }}>Geographic Sectors</span>
          <span style={{ fontSize: 10, fontFamily: "Verdana, sans-serif", color: "#a0c0e0", marginLeft: 6 }}>
            {(states ?? []).length} mapped states · {totalLocations} locations · {totalThreads} field reports
          </span>
        </div>
      </div>

      {/* Intro box */}
      <div style={{
        background: "#f0f4f8",
        border: "1px solid #b8c8d8",
        borderTop: "3px solid #e8760a",
        padding: "10px 14px",
        marginBottom: 12,
        fontFamily: "Verdana, Tahoma, Arial, sans-serif",
        fontSize: 11,
        color: "#334",
      }}>
        Browse urbex locations organized by US state. Click a sector to view its map, logged sites, and pinned field reports.
        All location data is community-contributed — <strong>opsec rules apply</strong>.
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 90, background: "#dde8f0" }} />
          ))}
        </div>
      ) : (states ?? []).length === 0 ? (
        <div style={{
          background: "white",
          border: "1px solid #b8c8d8",
          padding: "30px",
          textAlign: "center",
          fontFamily: "Verdana, sans-serif",
          fontSize: 12,
          color: "#667",
        }}>
          No sectors mapped yet. Admins can add states via the Admin Panel.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {(states as StateSummary[]).map(state => {
            const accentColor = STATUS_COLORS[state.abbreviation] ?? "#3a5f8a";
            return (
              <Link key={state.id} href={`/state/${state.slug}`}>
                <div style={{
                  background: "white",
                  border: "1px solid #c8d8e8",
                  borderTop: `3px solid ${accentColor}`,
                  padding: "10px 12px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "Verdana, Tahoma, Arial, sans-serif",
                  position: "relative",
                  overflow: "hidden",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = accentColor;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 8px ${accentColor}33`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#c8d8e8";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  {/* State abbreviation watermark */}
                  <div style={{
                    position: "absolute",
                    right: 8,
                    top: 4,
                    fontSize: 36,
                    fontWeight: "bold",
                    color: accentColor,
                    opacity: 0.08,
                    fontFamily: "Georgia, serif",
                    lineHeight: 1,
                    userSelect: "none",
                  }}>
                    {state.abbreviation}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{
                      background: accentColor,
                      color: "white",
                      padding: "2px 7px",
                      fontSize: 10,
                      fontWeight: "bold",
                      letterSpacing: 1,
                      borderRadius: 2,
                    }}>
                      {state.abbreviation}
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: 12, color: "#2b4a72" }}>
                      {state.name}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#556" }}>
                      <MapPin size={11} color={accentColor} />
                      <span><strong style={{ color: "#334" }}>{state.locationCount}</strong> site{state.locationCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#556" }}>
                      <MessageSquare size={11} color="#3a5f8a" />
                      <span><strong style={{ color: "#334" }}>{state.threadCount}</strong> report{state.threadCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 10, color: accentColor, fontWeight: "bold" }}>
                    View Sector →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom note */}
      <div style={{
        marginTop: 16,
        padding: "8px 12px",
        background: "#f8f4ec",
        border: "1px solid #e0d8c8",
        borderLeft: "3px solid #e8760a",
        fontFamily: "Verdana, Tahoma, Arial, sans-serif",
        fontSize: 10,
        color: "#667",
      }}>
        <strong style={{ color: "#444" }}>OPSEC REMINDER:</strong> Location intel shared here is for vetted members only.
        Do not share coordinates or access details outside the community.
        Admins can add/edit sectors via the Admin Panel.
      </div>
    </div>
  );
}
