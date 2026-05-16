import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetStateBySlug, useCreateLocation, getGetStateBySlugQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UrbexMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, PlusSquare, AlertTriangle, Shield, CheckCircle } from "lucide-react";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    city: "",
    latitude: 0,
    longitude: 0,
    status: "active" as const,
    risk: "medium" as const,
  });

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

  const markers = locations.map(loc => ({
    id: loc.id,
    lat: loc.latitude,
    lng: loc.longitude,
    title: loc.name,
    subtitle: loc.city || "Unknown",
    link: `/location/${loc.id}`,
    color: loc.status === 'demolished' ? 'hsl(var(--destructive))' : 
           loc.status === 'watched' ? 'hsl(var(--accent))' : 
           'hsl(var(--primary))'
  }));

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
        setFormData({ name: "", description: "", city: "", latitude: state.centerLat, longitude: state.centerLng, status: "active", risk: "medium" });
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
        <UrbexMap 
          center={[state.centerLat, state.centerLng]} 
          zoom={state.zoom} 
          markers={markers}
          className="h-[500px] w-full border border-border/50"
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
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <h2 className="font-serif text-lg text-primary tracking-widest uppercase">Grid Coordinates</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => (
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
          {locations.length === 0 && (
            <div className="col-span-full text-muted-foreground font-mono text-sm italic py-8 text-center border border-border/20 bg-card/10">
              No coordinates logged for this sector.
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
