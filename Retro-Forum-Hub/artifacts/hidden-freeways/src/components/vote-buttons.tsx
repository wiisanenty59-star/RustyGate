import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type VoteResult = {
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: "up" | "down" | "none";
};

type Props = {
  kind: "thread" | "post";
  id: number;
  initial?: Partial<VoteResult>;
};

export function VoteButtons({ kind, id, initial }: Props) {
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();
  const [state, setState] = useState<VoteResult>({
    upvotes: initial?.upvotes ?? 0,
    downvotes: initial?.downvotes ?? 0,
    score: initial?.score ?? 0,
    myVote: initial?.myVote ?? "none",
  });
  const [pending, setPending] = useState(false);

  async function castVote(value: "up" | "down") {
    if (!user) {
      toast({ title: "Sign in to vote", variant: "destructive" });
      return;
    }
    const next = state.myVote === value ? "none" : value;
    setPending(true);
    try {
      const result = await customFetch<VoteResult>(`/api/${kind}s/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      setState(result);
    } catch (err) {
      toast({
        title: "Vote failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1 select-none">
      <button
        type="button"
        onClick={() => castVote("up")}
        disabled={pending}
        className={cn(
          "p-1 border border-border/40 hover:border-primary/60 transition-colors rounded-none",
          state.myVote === "up" && "border-primary bg-primary/10 text-primary",
        )}
        aria-label="Upvote"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <span
        className={cn(
          "font-mono text-sm w-8 text-center tabular-nums",
          state.score > 0 && "text-primary",
          state.score < 0 && "text-destructive",
          state.score === 0 && "text-muted-foreground",
        )}
      >
        {state.score}
      </span>
      <button
        type="button"
        onClick={() => castVote("down")}
        disabled={pending}
        className={cn(
          "p-1 border border-border/40 hover:border-destructive/60 transition-colors rounded-none",
          state.myVote === "down" &&
            "border-destructive bg-destructive/10 text-destructive",
        )}
        aria-label="Downvote"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
