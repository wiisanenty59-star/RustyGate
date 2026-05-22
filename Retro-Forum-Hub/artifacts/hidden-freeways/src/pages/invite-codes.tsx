import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, useGetCurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Link as LinkIcon } from "lucide-react";

type InviteCode = {
  id: number;
  code: string;
  note: string | null;
  usedByUsername: string | null;
  usedAt: string | null;
  createdAt: string;
};

export default function InviteCodes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const [note, setNote] = useState("");

  const { data, isLoading, error } = useQuery<InviteCode[]>({
    queryKey: ["my-invites"],
    queryFn: () => customFetch<InviteCode[]>("/api/auth/my-invites"),
    staleTime: 30_000,
  });

  const canInvite = user?.role === "admin" || (user?.trustLevel ?? 0) >= 2;

  const createInvite = async () => {
    try {
      const invite = await customFetch<InviteCode>("/api/auth/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || null }),
      });

      queryClient.invalidateQueries({ queryKey: ["my-invites"] });
      setNote("");
      toast({ title: "Invite created", description: `Code: ${invite.code}` });
    } catch (e) {
      toast({ title: "Error creating invite", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-3xl uppercase tracking-widest">Invite Codes</h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-2">
            Generate and manage invite codes for trusted members.
          </p>
        </div>
        <Badge variant={canInvite ? "secondary" : "outline"} className="rounded-none">
          {canInvite ? "Invite Access" : "Requires Trust"}
        </Badge>
      </div>

      <div className="border border-border/50 bg-card/30 p-5 rounded-none space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LinkIcon size={14} />
          <span>
            Invite codes are tracked by creator and usage. Do not share codes publicly; abuse may result in suspension.
          </span>
        </div>

        {canInvite ? (
          <div className="grid gap-3">
            <Textarea
              placeholder="Add a note or context for this invite (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="font-mono text-sm rounded-none"
              rows={3}
            />
            <Button onClick={createInvite} className="font-serif uppercase rounded-none">
              <Plus className="w-4 h-4 mr-2" />Create Invite
            </Button>
          </div>
        ) : (
          <div className="rounded-none border border-dashed border-border/50 bg-muted/5 p-4 text-sm text-muted-foreground">
            Your account needs a higher trust level to issue invite codes. Contribute to the community to unlock this feature.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-serif text-2xl uppercase tracking-widest">Your Invites</h2>

        {isLoading ? (
          <div className="text-muted-foreground">Loading your invite history...</div>
        ) : error ? (
          <div className="text-destructive">Unable to load invites.</div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-none border border-border/50 bg-card/30 p-6 text-sm text-muted-foreground">
            No invite codes created yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {data.map((invite) => (
              <div key={invite.id} className="border border-border/50 p-4 rounded-none bg-card/30">
                <div className="font-mono text-sm text-primary break-all">{invite.code}</div>
                <div className="text-sm text-muted-foreground mt-2">{invite.note || "No note provided"}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{invite.usedAt ? `Used by ${invite.usedByUsername}` : "Unused"}</span>
                  <span>Created {new Date(invite.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
