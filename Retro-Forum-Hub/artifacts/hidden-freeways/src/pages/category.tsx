import { useParams, Link } from "wouter";
import { useGetCategoryBySlug, getGetCategoryBySlugQueryKey } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Pin, Lock, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Category() {
  const params = useParams();
  const slug = params.slug || "";
  const { data, isLoading } = useGetCategoryBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetCategoryBySlugQueryKey(slug) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-24 w-full bg-muted/20" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground font-mono">CHANNEL NOT FOUND</div>;
  }

  const { category, threads } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border border-border bg-card/30 p-6 backdrop-blur-sm">
        <h1 className="font-serif text-3xl text-primary tracking-widest uppercase mb-2">{category.name}</h1>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl">{category.description}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <h2 className="font-serif text-lg text-foreground tracking-widest uppercase">Active Transmissions</h2>
          <span className="font-mono text-xs text-muted-foreground">{threads.length} THREADS</span>
        </div>

        <div className="grid gap-2">
          {threads.length === 0 ? (
            <div className="text-center py-8 border border-border/50 bg-card/10 text-muted-foreground font-mono text-sm italic">
              No transmissions in this channel.
            </div>
          ) : (
            threads.map((thread) => (
              <Link key={thread.id} href={`/thread/${thread.id}`}>
                <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/50 bg-card/20 hover:bg-card/60 hover:border-primary/30 transition-all cursor-pointer gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {thread.isPinned && <Pin className="w-3 h-3 text-accent shrink-0" />}
                      {thread.isLocked && <Lock className="w-3 h-3 text-destructive shrink-0" />}
                      {thread.locationName && (
                        <Badge variant="outline" className="rounded-none border-primary/20 text-primary bg-primary/5 text-[9px] uppercase font-mono px-1 py-0 h-4 shrink-0 truncate max-w-[150px]">
                          {thread.locationName}
                        </Badge>
                      )}
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {thread.title}
                      </h3>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground font-mono gap-3 truncate">
                      <span>BY: <span className="text-foreground">{thread.authorUsername}</span></span>
                      <span className="opacity-30">|</span>
                      <span>INIT: {new Date(thread.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center sm:justify-end gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Latest Signal</div>
                      <div className="font-mono text-xs text-foreground">
                        {formatDistanceToNow(new Date(thread.lastActivityAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground min-w-[3rem] justify-end">
                      <MessageSquare className="w-3 h-3" />
                      <span className="font-mono text-xs">{thread.replyCount}</span>
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
