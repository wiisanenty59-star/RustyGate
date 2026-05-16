import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetThread, useCreatePost, getGetThreadQueryKey, useGetCurrentUser, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pin, Lock, Shield, MapPin, Terminal, Send, Edit2, X, Check, Star } from "lucide-react";
import { VoteButtons } from "@/components/vote-buttons";
import { PostBody } from "@/components/bbcode";
import { PostEditor } from "@/components/post-toolbar";
import { useToast } from "@/hooks/use-toast";

export default function ThreadDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const { data, isLoading } = useGetThread(id, {
    query: { enabled: !!id, queryKey: getGetThreadQueryKey(id) },
  });

  const createPost = useCreatePost();
  const [replyBody, setReplyBody] = useState("");

  // Edit thread state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = !!currentUser && !!data && (
    currentUser.id === data.thread.authorId || currentUser.role === "admin"
  );

  const startEdit = () => {
    if (!data) return;
    setEditTitle(data.thread.title);
    setEditBody(data.thread.body);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await customFetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      queryClient.invalidateQueries({ queryKey: getGetThreadQueryKey(id) });
      setEditing(false);
      toast({ title: "Thread updated" });
    } catch {
      toast({ title: "Error", description: "Could not save edits.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <Skeleton className="h-32 w-full bg-muted/20 border-border" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full bg-muted/20 border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground font-mono">TRANSMISSION LOST</div>;
  }

  const { thread, posts } = data;

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    createPost.mutate({ id, data: { body: replyBody } }, {
      onSuccess: () => {
        setReplyBody("");
        queryClient.invalidateQueries({ queryKey: getGetThreadQueryKey(id) });
      },
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Thread Header */}
      <div className="border border-border/50 bg-card/40 backdrop-blur-sm p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Terminal className="w-48 h-48 text-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Link href={`/category/${thread.categorySlug}`}>
              <Badge variant="outline" className="rounded-none border-primary/30 text-primary bg-primary/5 text-xs font-mono uppercase cursor-pointer hover:bg-primary/20 transition-colors">
                {thread.categoryName}
              </Badge>
            </Link>
            {thread.locationName && (
              <Link href={`/location/${thread.locationId}`}>
                <Badge variant="outline" className="rounded-none border-accent/30 text-accent bg-accent/5 text-xs font-mono uppercase cursor-pointer hover:bg-accent/20 transition-colors">
                  <MapPin className="w-3 h-3 mr-1" />
                  {thread.locationName}
                </Badge>
              </Link>
            )}
            {thread.isPinned && (
              <Badge variant="outline" className="rounded-none border-foreground/30 text-foreground bg-foreground/5 text-xs font-mono uppercase">
                <Pin className="w-3 h-3 mr-1" /> Pinned
              </Badge>
            )}
            {thread.isLocked && (
              <Badge variant="outline" className="rounded-none border-destructive/30 text-destructive bg-destructive/5 text-xs font-mono uppercase">
                <Lock className="w-3 h-3 mr-1" /> Locked
              </Badge>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 mb-6">
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="font-serif text-xl uppercase tracking-widest rounded-none bg-background border-primary/40"
              />
            </div>
          ) : (
            <h1 className="font-serif text-3xl md:text-4xl text-foreground tracking-widest uppercase mb-6 leading-tight">
              {thread.title}
            </h1>
          )}

          <div className="flex items-center gap-4 border-t border-border/50 pt-4">
            <Avatar className="h-10 w-10 rounded-none border border-border">
              <AvatarImage src={thread.authorAvatarUrl || ""} alt={thread.authorUsername} />
              <AvatarFallback className="rounded-none bg-secondary text-secondary-foreground font-mono text-xs">
                {thread.authorUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-mono text-sm text-primary uppercase tracking-wider">{thread.authorUsername}</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                INIT: {new Date(thread.createdAt).toLocaleString()} // VIEWS: {thread.viewCount}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && !editing && (
                <Button variant="ghost" size="icon" onClick={startEdit} className="h-8 w-8 rounded-none hover:bg-primary/20 hover:text-primary" title="Edit thread">
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              {editing && (
                <>
                  <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8 rounded-none hover:bg-destructive/20 hover:text-destructive">
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={saveEdit} disabled={saving} className="h-8 w-8 rounded-none bg-primary hover:bg-primary/90">
                    <Check className="w-4 h-4" />
                  </Button>
                </>
              )}
              <VoteButtons kind="thread" id={thread.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Original Post Body */}
      <div className="border border-border/50 bg-background p-6 md:p-8">
        {editing ? (
          <PostEditor
            value={editBody}
            onChange={setEditBody}
            rows={12}
          />
        ) : (
          <PostBody text={thread.body} />
        )}
      </div>

      {/* Replies */}
      <div className="space-y-4 pt-8">
        <h3 className="font-serif text-xl text-primary tracking-widest uppercase border-b border-border/50 pb-2">
          Transmissions ({posts.length})
        </h3>

        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-col md:flex-row gap-4 border border-border/50 bg-card/20 p-4">
              <div className="md:w-48 shrink-0 flex flex-row md:flex-col items-center md:items-start gap-3 border-b md:border-b-0 md:border-r border-border/50 pb-3 md:pb-0 md:pr-4">
                <Avatar className="h-12 w-12 rounded-none border border-border">
                  <AvatarImage src={post.authorAvatarUrl || ""} alt={post.authorUsername} />
                  <AvatarFallback className="rounded-none bg-secondary text-secondary-foreground font-mono text-sm">
                    {post.authorUsername.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-mono text-sm text-foreground flex items-center gap-1 uppercase tracking-wider">
                    {post.authorRole === "admin" && <Shield className="w-3 h-3 text-primary" />}
                    {post.authorUsername}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-1 flex items-center gap-1">
                    {post.authorRole}
                    {(post as { authorTrustLevel?: number }).authorTrustLevel !== undefined &&
                      (post as { authorTrustLevel?: number }).authorTrustLevel! >= 2 && (
                      <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <PostBody text={post.body} />
                <div className="mt-3 flex justify-end">
                  <VoteButtons kind="post" id={post.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply Box */}
      {!thread.isLocked ? (
        <div className="mt-8 border border-border/50 bg-card/40 p-4 md:p-6 backdrop-blur-sm">
          <h4 className="font-serif text-lg text-foreground tracking-widest uppercase mb-4 flex items-center">
            <Terminal className="w-4 h-4 mr-2 text-primary" /> Transmit Reply
          </h4>
          <form onSubmit={handleReply} className="space-y-4">
            <PostEditor
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Enter transmission data..."
              rows={6}
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={createPost.isPending}
                className="font-serif tracking-widest uppercase rounded-none w-full sm:w-auto"
              >
                <Send className="w-4 h-4 mr-2" />
                {createPost.isPending ? "Transmitting..." : "Send Transmission"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-8 text-center py-6 border border-destructive/30 bg-destructive/5 text-destructive font-mono text-sm uppercase tracking-widest">
          <Lock className="w-4 h-4 inline mr-2 mb-1" />
          Channel Locked - No further transmissions accepted
        </div>
      )}
    </div>
  );
}
