import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetStateBySlug, useCreateLocation, getGetStateBySlugQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { UrbexMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, PlusSquare, AlertTriangle, Shield, CheckCircle, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function State() {
  const params = useParams();
  const slug = params.slug || "";
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useGetStateBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetStateBySlugQueryKey(slug) }
  });

  const createLocation = useCreateLocation();
  const [mapStyle, setMapStyle] = useState<"dark" | "satellite">("dark");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("urbexMapStyle") : null;
    if (stored === "satellite" || stored === "dark") {
      setMapStyle(stored);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("urbexMapStyle", mapStyle);
    }
  }, [mapStyle]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSpotType, setActiveSpotType] = useState<"all" | "rooftop" | "tunnel" | "industrial" | "hospital" | "drain" | "military" | "other">("all");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    city: "",
    latitude: 0,
    longitude: 0,
    spotType: "other" as const,
    status: "active" as const,
    risk: "medium" as const,
  });
  const [activeLayerTags, setActiveLayerTags] = useState<string[]>([]);
  const { data: mapLayers } = useQuery<Array<{ id: number; title: string; description: string | null; layerTag: string; latitude: number; longitude: number; color: string | null }>>({
    queryKey: ["state-map-layers", slug],
    queryFn: () => customFetch(`/api/map-layers?stateSlug=${slug}`),
    enabled: !!slug,
  });

  useEffect(() => {
    if (mapLayers && activeLayerTags.length === 0) {
      setActiveLayerTags(Array.from(new Set(mapLayers.map((layer) => layer.layerTag))));
    }
  }, [mapLayers, activeLayerTags.length]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-[400px] w-full bg-muted/20 border-border" />
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full bg-muted/20 border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground font-mono">SECTOR DATA UNAVAILABLE</div>;
  }

  const { state, locations, pinnedThreads } = data;

  const spotTypeOptions = [
    { value: "all", label: "ALL SPOTS" },
    { value: "rooftop", label: "ROOFTOP" },
    { value: "tunnel", label: "TUNNEL" },
    { value: "industrial", label: "INDUSTRIAL" },
    { value: "hospital", label: "HOSPITAL" },
    { value: "drain", label: "DRAIN" },
    { value: "military", label: "MILITARY" },
    { value: "other", label: "OTHER" },
  ] as const;

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "rooftop":
        return "hsl(49, 100%, 58%)";
      case "tunnel":
        return "hsl(190, 100%, 58%)";
      case "industrial":
        return "hsl(345, 92%, 57%)";
      case "hospital":
        return "hsl(184, 99%, 35%)";
      case "drain":
        return "hsl(260, 80%, 60%)";
      case "military":
        return "hsl(113, 44%, 32%)";
      default:
        return "hsl(var(--primary))";
    }
  };

  const getSpotTypeLabel = (type: string) => {
    return type === "rooftop"
      ? "Rooftop"
      : type === "tunnel"
      ? "Tunnel"
      : type === "industrial"
      ? "Industrial"
      : type === "hospital"
      ? "Hospital"
      : type === "drain"
      ? "Drain"
      : type === "military"
      ? "Military"
      : "Other";
  };

  const totalLocations = locations.length;

  const allLayerTags = Array.from(new Set(mapLayers?.map((layer) => layer.layerTag) ?? []));
  const filteredLocations =
    activeSpotType === "all"
      ? locations
      : locations.filter((loc) => loc.spotType === activeSpotType);

  const layerMarkers = (mapLayers ?? [])
    .filter((layer) => activeLayerTags.includes(layer.layerTag))
    .map((layer) => ({
      id: `layer-${layer.id}`,
      lat: layer.latitude,
      lng: layer.longitude,
      title: layer.title,
      subtitle: layer.description || layer.layerTag,
      color: layer.color || "hsl(20, 80%, 60%)",
    }));

  const markers = [
    ...filteredLocations.map((loc) => ({
      id: loc.id,
      lat: loc.latitude,
      lng: loc.longitude,
      title: loc.name,
      subtitle: loc.city || "Unknown",
      link: `/location/${loc.id}`,
      color:
        loc.status === "demolished"
          ? "hsl(var(--destructive))"
          : loc.status === "watched"
          ? "hsl(var(--accent))"
          : getSpotTypeColor(loc.spotType),
    })),
    ...layerMarkers,
  ];

  const handleMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    createLocation.mutate({ 
      data: { 
        ...formData, 
        stateId: state.id,
        city: formData.city || null
      } 
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetStateBySlugQueryKey(slug) });
        setFormData({
          name: "",
          description: "",
          city: "",
          latitude: state.centerLat,
          longitude: state.centerLng,
          spotType: "other",
          status: "active",
          risk: "medium",
        });
      }
    });
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'medium': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      case 'high': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      case 'extreme': return 'text-destructive border-destructive/30 bg-destructive/10';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'active': return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'watched': return <Shield className="w-3 h-3 mr-1" />;
      case 'sealed': return <Lock className="w-3 h-3 mr-1" />;
      case 'demolished': return <AlertTriangle className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute top-4 right-4 z-[400] flex gap-2">
          {(["dark", "satellite"] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setMapStyle(style)}
              className={`rounded-none border px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-mono transition-colors ${
                mapStyle === style
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-background/70 text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {style === "dark" ? "DARK" : "SAT"}
            </button>
          ))}
        </div>
        <UrbexMap 
          center={[state.centerLat, state.centerLng]} 
          zoom={state.zoom} 
          markers={markers}
          className="h-[500px] w-full border border-border/50"
          mapStyle={mapStyle}
        />
        <div className="absolute top-4 left-4 z-[400] pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm border border-border/50 p-4 shadow-lg">
            <h1 className="font-serif text-3xl text-primary tracking-widest uppercase">{state.name}</h1>
            <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase mt-1">
              Sector {state.abbreviation} // {locations.length} Sites
            </p>
          </div>
        </div>
      </div>

      {pinnedThreads.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-lg text-primary tracking-widest uppercase border-b border-border/50 pb-2">Pinned Intel</h2>
          <div className="grid gap-2">
            {pinnedThreads.map(thread => (
              <Link key={thread.id} href={`/thread/${thread.id}`}>
                <div className="flex items-center justify-between p-3 border border-border/50 bg-card/20 hover:bg-card/60 transition-colors cursor-pointer group">
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{thread.title}</h3>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                      Author: {thread.authorUsername} // {formatDistanceToNow(new Date(thread.lastActivityAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-border/50 pb-2">
          <div>
            <h2 className="font-serif text-lg text-primary tracking-widest uppercase">Grid Coordinates</h2>
            <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Logged spots: {totalLocations} • Filter by spot type and explore the sector's tactical dossier grid.
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 rounded-none font-mono text-xs uppercase tracking-wider">
                <PlusSquare className="w-3 h-3 mr-2" /> Log Site
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border-border rounded-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl tracking-widest text-primary uppercase">Log New Coordinate</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLocation} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Designation</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-background/50 rounded-none border-border font-mono" placeholder="e.g. Abandoned Silo 4" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">City/Area</Label>
                    <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="bg-background/50 rounded-none border-border font-mono" placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Latitude</Label>
                    <Input required type="number" step="any" value={formData.latitude || ''} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} className="bg-background/50 rounded-none border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Longitude</Label>
                    <Input required type="number" step="any" value={formData.longitude || ''} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} className="bg-background/50 rounded-none border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Spot Type</Label>
                    <Select value={formData.spotType} onValueChange={(v: any) => setFormData({...formData, spotType: v})}>
                      <SelectTrigger className="bg-background/50 rounded-none border-border font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        <SelectItem value="rooftop">Rooftop</SelectItem>
                        <SelectItem value="tunnel">Tunnel</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                        <SelectItem value="drain">Drain</SelectItem>
                        <SelectItem value="military">Military</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Status</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                      <SelectTrigger className="bg-background/50 rounded-none border-border font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        <SelectItem value="active">Active/Open</SelectItem>
                        <SelectItem value="watched">Watched/Patrolled</SelectItem>
                        <SelectItem value="sealed">Sealed</SelectItem>
                        <SelectItem value="demolished">Demolished</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Risk Level</Label>
                    <Select value={formData.risk} onValueChange={(v: any) => setFormData({...formData, risk: v})}>
                      <SelectTrigger className="bg-background/50 rounded-none border-border font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        <SelectItem value="low">Low Risk</SelectItem>
                        <SelectItem value="medium">Medium Risk</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                        <SelectItem value="extreme">Extreme Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="font-mono text-xs uppercase text-muted-foreground">Field Notes</Label>
                    <Textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-background/50 rounded-none border-border font-mono min-h-[100px]" placeholder="Access details, conditions..." />
                  </div>
                </div>
                <Button type="submit" disabled={createLocation.isPending} className="w-full font-serif tracking-widest uppercase rounded-none">
                  {createLocation.isPending ? "UPLOADING..." : "SUBMIT INTEL"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {spotTypeOptions.map((type) => (
            <button
              key={type.value}
              type="button"
              className={`rounded-none border px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-mono transition-colors ${
                activeSpotType === type.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary"
              }`}
              onClick={() => setActiveSpotType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {allLayerTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {allLayerTags.map((tag) => {
              const isActive = activeLayerTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setActiveLayerTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((item) => item !== tag)
                        : [...prev, tag]
                    )
                  }
                  className={`rounded-none border px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-mono transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.map(loc => (
            <Link key={loc.id} href={`/location/${loc.id}`}>
              <div className="group border border-border/50 bg-card/20 hover:bg-card/60 hover:border-primary/40 transition-all cursor-pointer p-4 h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <MapPin className="w-16 h-16 text-primary" />
                </div>
                <div className="relative z-10 flex-1">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className={`rounded-none text-[9px] uppercase font-mono px-1 py-0 h-4 border-border`}>
                      {getStatusIcon(loc.status)}
                      {loc.status}
                    </Badge>
                    <Badge variant="outline" className={`rounded-none text-[9px] uppercase font-mono px-1 py-0 h-4 ${getRiskColor(loc.risk)}`}>
                      RISK: {loc.risk}
                    </Badge>
                    <Badge variant="outline" className={`rounded-none text-[9px] uppercase font-mono px-1 py-0 h-4 border-border`}>
                      {getSpotTypeLabel(loc.spotType)}
                    </Badge>
                  </div>
                  <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors leading-tight mb-1">{loc.name}</h3>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                    {loc.city || "Unknown Area"} // {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{loc.description}</p>
                </div>
                <div className="relative z-10 mt-4 pt-3 border-t border-border/50 flex justify-between items-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>{loc.threadCount} Threads</span>
                  <span>Log: {loc.createdByUsername}</span>
                </div>
              </div>
            </Link>
          ))}
          {filteredLocations.length === 0 && (
            <div className="col-span-full text-muted-foreground font-mono text-sm italic py-8 text-center border border-border/20 bg-card/10">
              No coordinates match the selected spot type.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Lock(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
}
