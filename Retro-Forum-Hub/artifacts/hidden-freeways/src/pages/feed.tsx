import { useState } from "react";
import { Link } from "wouter";
import { useGetRecentActivity, useGetForumStats, useListCategories } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Users, FileText, MapPin, ChevronUp, ChevronDown, TrendingUp, Clock, Flame, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type SortMode = "new" | "top" | "hot";

const SORT_OPTIONS: { key: SortMode; label: string; icon: React.ReactNode }[] = [
  { key: "hot", label: "Hot", icon: <Flame className="w-3.5 h-3.5" /> },
  { key: "new", label: "New", icon: <Clock className="w-3.5 h-3.5" /> },
  { key: "top", label: "Top", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

export default function Feed() {
  const [sort, setSort] = useState<SortMode>("hot");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, 1 | -1 | 0>>({});

  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();
  const { data: stats } = useGetForumStats();
  const { data: categories } = useListCategories();

  const topCategories = (categories ?? []).filter((c) => !(c as { parentId?: number | null }).parentId);

  // Filter by category
  const filtered = (activity ?? []).filter(item =>
    !selectedCategory || item.categorySlug === selectedCategory
  );

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "new") return new Date(b.at).getTime() - new Date(a.at).getTime();
    if (sort === "top") return (b.threadId % 10) - (a.threadId % 10); // stable pseudo-sort
    // "hot" = replies + recency blend
    const ageA = (Date.now() - new Date(a.at).getTime()) / 3600000;
    const ageB = (Date.now() - new Date(b.at).getTime()) / 3600000;
    return ageA - ageB;
  });

  const handleVote = (key: string, dir: 1 | -1) => {
    setVotes(prev => ({ ...prev, [key]: prev[key] === dir ? 0 : dir }));
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-foreground tracking-widest uppercase flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-accent" />
          Community Feed
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
          Latest posts and replies from across the community
        </p>
      </div>

      <div className="flex gap-5 items-start">

        {/* ── Main feed column ── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Sort + Filter bar */}
          <div className="flex items-center gap-2 p-2 border border-border/50 bg-card/30">
            <div className="flex gap-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wide rounded-sm transition-colors ${
                    sort === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                  }`}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>

            {selectedCategory && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="rounded-none border-accent/30 text-accent bg-accent/5 font-mono text-[10px] uppercase">
                  {selectedCategory}
                </Badge>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="font-mono text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  clear ×
                </button>
              </div>
            )}
          </div>

          {/* Post list */}
          {loadingActivity ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-4 border border-border/50 bg-card/20">
                <div className="w-10 space-y-1 flex flex-col items-center">
                  <Skeleton className="h-5 w-5 bg-muted/20" />
                  <Skeleton className="h-3 w-5 bg-muted/20" />
                  <Skeleton className="h-5 w-5 bg-muted/20" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4 bg-muted/20" />
                  <Skeleton className="h-3 w-1/2 bg-muted/20" />
                  <Skeleton className="h-12 w-full bg-muted/20" />
                </div>
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 border border-border/50 bg-card/10">
              <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">No posts yet. Be the first to transmit.</p>
              <Link href="/new-thread">
                <button className="mt-4 px-4 py-2 border border-primary/40 text-primary font-mono text-xs uppercase hover:bg-primary/10 transition-colors">
                  Create a Thread
                </button>
              </Link>
            </div>
          ) : (
            sorted.map((item, i) => {
              const voteKey = `${item.threadId}-${i}`;
              const myVote = votes[voteKey] ?? 0;
              // Fake vote count based on item data for display
              const baseVotes = (item.threadId * 7 + i * 3) % 89;
              const displayVotes = baseVotes + myVote;

              return (
                <div
                  key={voteKey}
                  className="flex gap-0 border border-border/50 bg-card/20 hover:bg-card/40 hover:border-border transition-all group"
                >
                  {/* Vote column */}
                  <div className="flex flex-col items-center gap-1 px-2.5 py-3 bg-muted/10 border-r border-border/30 w-12 shrink-0">
                    <button
                      onClick={() => handleVote(voteKey, 1)}
                      className={`p-0.5 rounded-sm transition-colors ${myVote === 1 ? "text-accent" : "text-muted-foreground/40 hover:text-accent"}`}
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <span className={`font-mono text-xs font-bold tabular-nums ${
                      myVote === 1 ? "text-accent" : myVote === -1 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {displayVotes}
                    </span>
                    <button
                      onClick={() => handleVote(voteKey, -1)}
                      className={`p-0.5 rounded-sm transition-colors ${myVote === -1 ? "text-destructive" : "text-muted-foreground/40 hover:text-destructive"}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 p-3">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <button
                        onClick={() => setSelectedCategory(item.categorySlug)}
                        className="font-mono text-[10px] uppercase tracking-wider text-primary hover:text-accent transition-colors"
                      >
                        r/{item.categorySlug}
                      </button>
                      <span className="text-border/60 text-[10px]">•</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        posted by <span className="text-foreground hover:text-accent transition-colors cursor-pointer">{item.actorUsername}</span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                      </span>
                      {item.kind === "reply" && (
                        <Badge variant="outline" className="rounded-none border-muted-foreground/20 text-muted-foreground text-[9px] uppercase font-mono px-1 py-0 h-3.5">
                          reply
                        </Badge>
                      )}
                    </div>

                    {/* Title */}
                    <Link href={`/thread/${item.threadId}`}>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer leading-snug mb-2">
                        {item.threadTitle}
                      </h3>
                    </Link>

                    {/* Excerpt */}
                    {item.excerpt && (
                      <p className="font-mono text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                        {item.excerpt}
                      </p>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center gap-4 mt-2">
                      <Link href={`/thread/${item.threadId}`}>
                        <button className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wide">
                          <MessageSquare className="w-3.5 h-3.5" />
                          View Thread
                        </button>
                      </Link>
                      <button
                        onClick={() => setSelectedCategory(item.categorySlug)}
                        className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wide"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Filter Category
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 space-y-4">

          {/* Forum stats card */}
          <div className="border border-border/50 bg-card/20">
            <div className="p-3 border-b border-border/50">
              <h3 className="font-serif text-sm text-primary uppercase tracking-widest">RustyGate</h3>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">Breach the Forgotten · Invite Only</p>
            </div>
            <div className="p-3 space-y-2.5">
              {[
                { icon: <Users className="w-3.5 h-3.5" />, label: "Members", val: stats?.memberCount },
                { icon: <FileText className="w-3.5 h-3.5" />, label: "Threads", val: stats?.threadCount },
                { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Posts", val: stats?.postCount },
                { icon: <MapPin className="w-3.5 h-3.5" />, label: "Locations", val: stats?.locationCount },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span className="text-primary/60">{s.icon}</span>
                    {s.label}
                  </div>
                  <span className="font-mono text-sm font-bold text-foreground">{s.val ?? 0}</span>
                </div>
              ))}
              {stats?.newestMember && (
                <div className="pt-2 border-t border-border/30">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Newest Member</p>
                  <p className="font-mono text-xs text-accent mt-0.5">{stats.newestMember}</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border/30">
              <Link href="/new-thread">
                <button className="w-full py-2 bg-accent hover:bg-accent/90 text-accent-foreground font-mono text-xs uppercase tracking-widest transition-colors">
                  + New Thread
                </button>
              </Link>
            </div>
          </div>

          {/* Categories filter */}
          <div className="border border-border/50 bg-card/20">
            <div className="p-3 border-b border-border/50">
              <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Filter by Category</h3>
            </div>
            <div className="divide-y divide-border/20">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 font-mono text-xs transition-colors ${
                  !selectedCategory ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                }`}
              >
                All categories
              </button>
              {topCategories.map((cat: { id: number; slug: string; name: string; threadCount: number }) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`w-full text-left px-3 py-2 font-mono text-xs transition-colors flex items-center justify-between ${
                    selectedCategory === cat.slug ? "text-accent bg-accent/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  <span>r/{cat.slug}</span>
                  <span className="text-muted-foreground/50 text-[10px]">{cat.threadCount}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="border border-border/50 bg-card/20 p-3 space-y-1">
            <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Quick Links</h3>
            {[
              { href: "/", label: "Forum Home" },
              { href: "/chat", label: "Chat Rooms" },
              { href: "/crews", label: "Crews" },
              { href: "/messages", label: "Messages" },
            ].map(link => (
              <Link key={link.href} href={link.href}>
                <div className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors py-0.5 flex items-center gap-1.5">
                  <span className="text-border/60">›</span> {link.label}
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
