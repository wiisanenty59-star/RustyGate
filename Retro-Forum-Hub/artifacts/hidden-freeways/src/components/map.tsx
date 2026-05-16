import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "wouter";

// Create custom urbex icon
export const createCustomIcon = (color: string = "hsl(var(--primary))", active: boolean = false) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 16px;
      height: 16px;
      background-color: ${color};
      border: 2px solid hsl(var(--background));
      box-shadow: 0 0 ${active ? "15px 5px" : "10px 2px"} ${color}40;
      transform: rotate(45deg);
      transition: all 0.3s ease;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
};

const defaultIcon = createCustomIcon();
const activeIcon = createCustomIcon("hsl(var(--accent))", true);

interface MapProps {
  center: [number, number];
  zoom: number;
  markers?: Array<{
    id: string | number;
    lat: number;
    lng: number;
    title: string;
    subtitle?: string;
    link?: string;
    color?: string;
  }>;
  onMarkerClick?: (id: string | number) => void;
  className?: string;
  interactive?: boolean;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export function UrbexMap({ center, zoom, markers = [], onMarkerClick, className = "h-[400px] w-full", interactive = true }: MapProps) {
  return (
    <div className={`border border-border/50 bg-muted/20 relative z-0 ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        className="h-full w-full"
      >
        <MapUpdater center={center} zoom={zoom} />
        
        {/* Dark CARTO tiles for urbex feel */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={marker.color ? createCustomIcon(marker.color) : defaultIcon}
            eventHandlers={{
              click: () => onMarkerClick?.(marker.id),
            }}
          >
            <Popup className="urbex-popup">
              <div className="font-mono text-xs text-foreground bg-background p-2 border border-border">
                <div className="font-bold text-primary uppercase tracking-wider mb-1">
                  {marker.title}
                </div>
                {marker.subtitle && (
                  <div className="text-muted-foreground mb-2">{marker.subtitle}</div>
                )}
                {marker.link && (
                  <Link href={marker.link} className="text-accent hover:text-primary transition-colors inline-block mt-1">
                    [ACCESS LOGS]
                  </Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// Global styles for popup to override leaflet defaults
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    .leaflet-popup-content-wrapper {
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      border-radius: 0;
      padding: 0;
      border: 1px solid hsl(var(--border));
    }
    .leaflet-popup-tip {
      background: hsl(var(--background));
      border-top: 1px solid hsl(var(--border));
      border-left: 1px solid hsl(var(--border));
    }
    .leaflet-container a.leaflet-popup-close-button {
      color: hsl(var(--muted-foreground));
      padding: 4px;
    }
    .leaflet-container a.leaflet-popup-close-button:hover {
      color: hsl(var(--foreground));
    }
    .custom-marker {
      background: transparent;
      border: none;
    }
  `;
  document.head.appendChild(style);
}
