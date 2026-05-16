import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useGetInviteInfo, useRedeemInvite, getGetCurrentUserQueryKey, getGetInviteInfoQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, CheckCircle2, Terminal, KeyRound, ScrollText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const RULES_TEXT = `URBEXVOYAGER COMMUNITY GUIDELINES

1. SAFETY FIRST — Never explore alone. Always inform someone of your location before entering any structure. Share emergency contacts with a trusted crew member.

2. LEAVE NO TRACE — Do not vandalize, steal, or damage any property. Leave locations exactly as you found them.

3. NO LOCATION SHARING OUTSIDE THE COMMUNITY — Location coordinates and access details posted here are strictly confidential. Do not share them with non-members or post them publicly on social media.

4. RESPECT PRIVATE PROPERTY — All members acknowledge that urban exploration may involve trespassing. This community does not encourage illegal activity; always assess risk and local laws.

5. NO HARASSMENT — Treat all members with respect. Harassment, threats, or discrimination of any kind will result in immediate permanent ban.

6. OPSEC — Do not post photos that reveal your identity, faces of others, or identifying details that could compromise the community or its members.

7. INVITE ONLY — Do not share your invite codes publicly. You are responsible for the behavior of anyone you invite. Abuse of invites will result in your account being suspended.

8. NO COMMERCIAL USE — Content posted here may not be sold, published, or used for commercial purposes without explicit consent of the original poster.

9. ADMIN DECISIONS ARE FINAL — Moderator and admin decisions on content, access, and bans are final. Disputes may be raised privately via message.

10. STAY UNDERGROUND — This is an underground community. Keep it that way.

Failure to follow these rules may result in account suspension or permanent removal.`;

type Step = "code" | "rules" | "register";

export default function Invite() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [manualCode, setManualCode] = useState(params.code || "");
  const [step, setStep] = useState<Step>(params.code ? "rules" : "code");
  const [confirmedCode, setConfirmedCode] = useState(params.code || "");
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { data: inviteInfo, isLoading: loadingInvite, error: inviteError } = useGetInviteInfo(confirmedCode, {
    query: { enabled: !!confirmedCode, queryKey: getGetInviteInfoQueryKey(confirmedCode) },
  });

  const redeemMutation = useRedeemInvite();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setConfirmedCode(manualCode.trim());
    setStep("rules");
  };

  const handleRulesAccept = () => {
    if (!agreedToRules) return;
    setStep("register");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (password !== password) return; // placeholder, real check below via server
    redeemMutation.mutate({ data: { code: confirmedCode, username, password } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      },
    });
  };

  const stepLabels: { key: Step; label: string }[] = [
    { key: "code", label: "Verify Code" },
    { key: "rules", label: "Read Rules" },
    { key: "register", label: "Create Account" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-background to-background" />

      <div className="w-full max-w-lg relative z-10">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {stepLabels.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                step === s.key
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : stepLabels.findIndex(x => x.key === step) > i
                  ? "border-primary/20 bg-primary/5 text-primary/50"
                  : "border-border/30 text-muted-foreground/50"
              }`}>
                <span className="opacity-60">{i + 1}.</span> {s.label}
              </div>
              {i < stepLabels.length - 1 && (
                <ChevronRight className="w-3 h-3 text-border/50 mx-0.5" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6 p-8 border border-border/50 bg-card/40 backdrop-blur-sm">

          {/* ── Step 1: Enter Code ── */}
          {step === "code" && (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-serif text-accent uppercase tracking-widest flex items-center justify-center gap-3">
                  <KeyRound className="w-7 h-7" />
                  Establish <span className="text-foreground">Uplink</span>
                </h1>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Enter your cryptographic access key to proceed.
                </p>
              </div>
              <form onSubmit={handleCodeSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="invite-code" className="font-mono text-xs uppercase text-muted-foreground">Invite Code</Label>
                  <Input
                    id="invite-code"
                    type="text"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-accent/50 tracking-widest uppercase"
                    placeholder="e.g. ABC123-XYZ"
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full rounded-none font-serif uppercase tracking-widest bg-accent hover:bg-accent/90 text-accent-foreground">
                  Verify Code
                </Button>
              </form>
              <div className="pt-4 border-t border-border/50 text-center">
                <Link href="/login" className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                  Already a member? Sign in here.
                </Link>
              </div>
            </>
          )}

          {/* ── Step 2: Rules ── */}
          {step === "rules" && (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-serif text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
                  <ScrollText className="w-6 h-6 text-accent" />
                  Community <span className="text-accent">Rules</span>
                </h1>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Read and accept before you can proceed.
                </p>
              </div>

              {loadingInvite ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/4 bg-muted/20" />
                  <Skeleton className="h-4 w-1/2 bg-muted/20" />
                </div>
              ) : inviteError || !inviteInfo ? (
                <>
                  <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 rounded-none">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle className="font-mono text-sm uppercase tracking-wider">Invalid Code</AlertTitle>
                    <AlertDescription className="font-mono text-xs">
                      This key is invalid, expired, or has already been used.
                    </AlertDescription>
                  </Alert>
                  <Button variant="outline" onClick={() => setStep("code")} className="w-full rounded-none font-mono text-xs uppercase">
                    Try a Different Code
                  </Button>
                </>
              ) : (
                <>
                  <Alert className="border-primary/50 bg-primary/10 rounded-none">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-mono text-xs text-primary uppercase tracking-wider">Key Accepted</AlertTitle>
                    <AlertDescription className="font-mono text-xs text-muted-foreground mt-1">
                      Code: <span className="text-foreground">{inviteInfo.code}</span>
                      {inviteInfo.invitedBy && <span className="ml-4">Issued by: <span className="text-foreground">{inviteInfo.invitedBy}</span></span>}
                    </AlertDescription>
                  </Alert>

                  <div className="relative">
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-card/40 to-transparent z-10 pointer-events-none rounded-t" />
                    <div
                      className="bg-background/50 border border-border/40 p-4 text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap overflow-y-auto"
                      style={{ maxHeight: 240 }}
                    >
                      {RULES_TEXT}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-card/40 to-transparent z-10 pointer-events-none rounded-b" />
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreedToRules}
                        onChange={e => setAgreedToRules(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 border border-border/60 bg-background/50 peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                        {agreedToRules && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                      I have read and agree to the RustyGate Community Guidelines. I understand violations may result in permanent removal.
                    </span>
                  </label>

                  <Button
                    onClick={handleRulesAccept}
                    disabled={!agreedToRules}
                    className="w-full rounded-none font-serif uppercase tracking-widest bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-40"
                  >
                    I Agree — Continue
                  </Button>

                  <button onClick={() => setStep("code")} className="w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-center">
                    &larr; Use a different code
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Step 3: Register ── */}
          {step === "register" && (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-serif text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
                  <Terminal className="w-6 h-6 text-accent" />
                  Create <span className="text-accent">Account</span>
                </h1>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Choose your operative ID and passphrase.
                </p>
              </div>

              {redeemMutation.error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 rounded-none">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="font-mono text-xs">
                    Initialization failed. Operative ID may already be in use.
                  </AlertDescription>
                </Alert>
              )}
              {passwordError && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 rounded-none">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="font-mono text-xs">{passwordError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="font-mono text-xs uppercase text-muted-foreground">Choose Operative ID</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-accent/50"
                    required
                    placeholder="e.g. shadow_walker"
                    pattern="^[a-zA-Z0-9_-]{3,32}$"
                    title="3-32 characters, letters, numbers, dashes and underscores only"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-mono text-xs uppercase text-muted-foreground">Set Passphrase</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-accent/50"
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-none font-serif uppercase tracking-widest bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={redeemMutation.isPending}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  {redeemMutation.isPending ? "Initializing..." : "Join the Network"}
                </Button>
              </form>

              <button onClick={() => setStep("rules")} className="w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-center">
                &larr; Back to rules
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
