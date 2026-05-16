import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, ShieldAlert } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    loginMutation.mutate({ data: { username, password } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="w-full max-w-md relative z-10 space-y-8 p-8 border border-border/50 bg-card/40 backdrop-blur-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">
            Null<span className="text-foreground">Access</span>
          </h1>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
            Members Only. The freeways stay hidden.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMutation.error && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 rounded-none">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="font-mono text-xs">
                Access Denied: Invalid credentials.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-mono text-xs uppercase text-muted-foreground">Operative ID</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-primary/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase text-muted-foreground">Passphrase</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-primary/50"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-none font-serif uppercase tracking-widest hover:bg-primary/90 transition-colors"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Authenticating..." : "Initialize Uplink"}
          </Button>
        </form>

        <div className="pt-6 border-t border-border/50 text-center">
          <Link href="/invite" className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
            <KeyRound className="w-3 h-3" />
            Have an invite code? Redeem here.
          </Link>
        </div>
      </div>
    </div>
  );
}
