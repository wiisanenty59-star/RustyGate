import { useParams, Link } from "wouter";
import { useGetLocation, getGetLocationQueryKey } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { UrbexMap } from "@/components/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusSquare, MessageSquare, MapPin, AlertTriangle, Shield, Lock, CheckCircle } from "lucide-react";

export default function LocationDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data, isLoading } = useGetLocation(id, {
    query: { enabled: !!id, queryKey: getGetLocationQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-[300px] w-full bg-muted/20 border-border" />
        <Skeleton className="h-12 w-3/4 bg-muted/20" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-muted/20 border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground font-mono">LOCATION INTEL NOT FOUND</div>;
  }

  const { location, threads } = data;

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
      case 'active': return <CheckCircle className="w-4 h-4 mr-1.5" />;
      case 'watched': return <Shield className="w-4 h-4 mr-1.5" />;
      case 'sealed': return <Lock className="w-4 h-4 mr-1.5" />;
      case 'demolished': return <AlertTriangle className="w-4 h-4 mr-1.5" />;
      default: return null;
    }
  };

  const markerColor = location.status === 'demolished' ? 'hsl(var(--destructive))' : 
                     location.status === 'watched' ? 'hsl(var(--accent))' : 
                     'hsl(var(--primary))';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative border border-border/50 bg-card/20 overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <MapPin className="w-64 h-64 text-primary" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="p-6 lg:p-8 lg:col-span-2 relative z-10 flex flex-col justify-center">
            <div className="flex gap-3 mb-4 flex-wrap">
              <Badge variant="outline" className="rounded-none text-xs uppercase font-mono px-2 py-1 border-border bg-background/50 backdrop-blur-sm">
                {getStatusIcon(location.status)}
                {location.status}
              </Badge>
              <Badge variant="outline" className={`rounded-none text-xs uppercase font-mono px-2 py-1 bg-background/50 backdrop-blur-sm ${getRiskColor(location.risk)}`}>
                RISK: {location.risk}
              </Badge>
            </div>
            
            <h1 className="font-serif text-3xl md:text-5xl text-primary tracking-widest uppercase mb-2">
              {location.name}
            </h1>
            
            <div className="font-mono text-xs md:text-sm text-muted-foreground tracking-widest uppercase mb-6 flex flex-wrap items-center gap-2">
              <span>{location.city || "Unknown Area"}</span>
              <span className="opacity-50">/</span>
              <Link href={`/state/${location.stateSlug}`} className="hover:text-primary transition-colors cursor-pointer">
                Sector {location.stateName}
              </Link>
              <span className="opacity-50">/</span>
              <span className="text-accent">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
            </div>
            
            <div className="prose prose-invert prose-p:font-mono prose-p:text-sm prose-p:leading-relaxed max-w-none">
              <p>{location.description}</p>
            </div>
            
            <div className="mt-8 pt-4 border-t border-border/50 font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Logged by: {location.createdByUsername}</span>
              <span>{new Date(location.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="h-[300px] lg:h-auto border-t lg:border-t-0 lg:border-l border-border/50 relative">
            <UrbexMap 
              center={[location.latitude, location.longitude]} 
              zoom={15} 
              markers={[{
                id: location.id,
                lat: location.latitude,
                lng: location.longitude,
                title: location.name,
                color: markerColor
              }]}
              className="h-full w-full"
              interactive={false}
            />
            <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20 mix-blend-overlay" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h2 className="font-serif text-xl text-primary tracking-widest uppercase">Field Reports</h2>
            <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">{threads.length} Transmissions</p>
          </div>
          <Link href={`/new-thread?locationId=${location.id}`}>
            <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 rounded-none font-mono text-xs uppercase tracking-wider w-full sm:w-auto">
              <PlusSquare className="w-4 h-4 mr-2" /> Log Report
            </Button>
          </Link>
        </div>

        <div className="grid gap-3">
          {threads.length === 0 ? (
            <div className="text-center py-12 border border-border/50 bg-card/10 text-muted-foreground font-mono text-sm italic">
              No field reports logged for this coordinate.
            </div>
          ) : (
            threads.map(thread => (
              <Link key={thread.id} href={`/thread/${thread.id}`}>
                <div className="group border border-border/50 bg-card/20 hover:bg-card/60 hover:border-primary/30 transition-all cursor-pointer p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-lg text-foreground group-hover:text-primary transition-colors leading-tight">
                        {thread.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {thread.excerpt}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground font-mono gap-3 uppercase tracking-wider">
                      <span className="text-accent">{thread.authorUsername}</span>
                      <span className="opacity-30">/</span>
                      <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center md:justify-end gap-6 shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t border-border/50 md:border-0">
                    <div className="text-left md:text-right">
                      <div className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Latest Signal</div>
                      <div className="font-mono text-xs text-foreground">
                        {formatDistanceToNow(new Date(thread.lastActivityAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground min-w-[3rem] justify-end">
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-mono text-sm">{thread.replyCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
