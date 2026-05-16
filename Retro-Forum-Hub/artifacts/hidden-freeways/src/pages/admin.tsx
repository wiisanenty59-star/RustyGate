import { useState, useEffect } from "react";
import {
  useAdminListUsers, useAdminUpdateUser,
  useAdminListInvites, useAdminCreateInvite, useAdminRevokeInvite,
  useListCategories, useAdminCreateCategory, useAdminUpdateCategory, useAdminDeleteCategory,
  useListStates, useAdminCreateState, useAdminUpdateState, useAdminDeleteState,
  useListLocations, useAdminUpdateLocation, useAdminDeleteLocation,
  useListThreads, useAdminPinThread, useAdminDeleteThread,
  useGetForumStats,
  customFetch,
  getAdminListUsersQueryKey, getAdminListInvitesQueryKey,
  getListCategoriesQueryKey, getListStatesQueryKey,
  getListLocationsQueryKey, getListThreadsQueryKey,
  getGetForumStatsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, KeyRound, Globe, MapPin, MessageSquare, Trash2, Edit2, Plus,
  Copy, Ban, UserCheck, FileText, Settings, Pin, PinOff, BellRing,
  Radio, Archive, ArchiveRestore, UserX, Users, TrendingUp, Lock, Unlock,
  CheckCircle, XCircle, ChevronRight,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Tab nav ───────────────────────────────────────────────────────────────────

type Tab = "invites" | "users" | "categories" | "states" | "locations" | "threads" | "guidelines" | "noticeboard" | "chat";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "invites",    label: "Invites",     icon: <KeyRound size={14} /> },
  { key: "users",      label: "Users",       icon: <Users size={14} /> },
  { key: "categories", label: "Categories",  icon: <Layers size={14} /> },
  { key: "states",     label: "Sectors",     icon: <Globe size={14} /> },
  { key: "locations",  label: "Locations",   icon: <MapPin size={14} /> },
  { key: "threads",    label: "Threads",     icon: <MessageSquare size={14} /> },
  { key: "guidelines", label: "Guidelines",  icon: <FileText size={14} /> },
  { key: "noticeboard",label: "Noticeboard", icon: <BellRing size={14} /> },
  { key: "chat",       label: "Chat Rooms",  icon: <Radio size={14} /> },
];

function Layers(props: { size: number }) {
  return <svg width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number | string | undefined; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-card/40 border border-border/50 rounded-none flex-1 min-w-[120px]">
      <div style={{ color }} className="opacity-80">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{value ?? 0}</div>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState<Tab>("invites");
  const { data: stats } = useGetForumStats();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-foreground tracking-widest uppercase">Admin Panel</h1>
          <p className="font-mono text-[11px] text-muted-foreground tracking-widest uppercase">System Control Interface</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="Members" value={stats?.memberCount} icon={<Users className="w-5 h-5" />} color="hsl(var(--primary))" />
        <StatCard label="Threads" value={stats?.threadCount} icon={<MessageSquare className="w-5 h-5" />} color="hsl(var(--accent))" />
        <StatCard label="Posts" value={stats?.postCount} icon={<FileText className="w-5 h-5" />} color="#2b7a4b" />
        <StatCard label="Locations" value={stats?.locationCount} icon={<MapPin className="w-5 h-5" />} color="#e8760a" />
        <StatCard label="Sectors" value={stats?.stateCount} icon={<Globe className="w-5 h-5" />} color="#7a2b82" />
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 border-b border-border/50 pb-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[500px]">
        {tab === "invites"    && <InvitesTab />}
        {tab === "users"      && <UsersTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "states"     && <StatesTab />}
        {tab === "locations"  && <LocationsTab />}
        {tab === "threads"    && <ThreadsTab />}
        {tab === "guidelines" && <GuidelinesTab />}
        {tab === "noticeboard"&& <NoticeboardTab />}
        {tab === "chat"       && <ChatRoomsTab />}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="font-serif text-lg text-foreground tracking-widest uppercase">{title}</h2>
        {desc && <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Invites ────────────────────────────────────────────────────────────────────

function InvitesTab() {
  const { data, isLoading } = useAdminListInvites();
  const createInvite = useAdminCreateInvite();
  const revokeInvite = useAdminRevokeInvite();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = () => {
    createInvite.mutate({ data: { note: note || null } }, {
      onSuccess: () => {
        setNote(""); setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getAdminListInvitesQueryKey() });
        toast({ title: "Invite code generated" });
      },
    });
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite link copied" });
  };

  const handleRevoke = (id: number) => {
    if (!confirm("Revoke this invite?")) return;
    revokeInvite.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListInvitesQueryKey() });
        toast({ title: "Invite revoked" });
      },
    });
  };

  const active = (data ?? []).filter(i => !i.usedById).length;
  const used = (data ?? []).filter(i => !!i.usedById).length;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Invite Codes"
        desc={`${active} active · ${used} used — generate codes to invite new members`}
        action={
          <Button onClick={() => setCreateOpen(true)} className="font-mono text-xs uppercase tracking-wide rounded-none">
            <Plus className="w-4 h-4 mr-1.5" /> Generate Code
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-widest uppercase text-base">Generate Invite</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Internal Note (optional)</label>
              <Input value={note} onChange={e => setNote(e.target.value)} className="rounded-none font-mono" placeholder="Who is this for?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-none font-mono text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvite.isPending} className="rounded-none font-mono text-xs uppercase">Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Code</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Note</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Created By</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 font-mono text-xs text-muted-foreground">No invites yet. Generate one above.</TableCell></TableRow>
            ) : (data ?? []).map(invite => (
              <TableRow key={invite.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="font-mono text-sm text-primary font-semibold tracking-wider">{invite.code}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{invite.note || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{invite.createdByUsername}</TableCell>
                <TableCell>
                  {invite.usedById ? (
                    <Badge variant="outline" className="rounded-none border-muted-foreground/30 text-muted-foreground text-[10px] uppercase font-mono">
                      Used by {invite.usedByUsername}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-none border-green-500/40 text-green-500 bg-green-500/5 text-[10px] uppercase font-mono">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!invite.usedById && (
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(invite.code)} title="Copy link" className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary"><Copy className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(invite.id)} title="Revoke" className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data, isLoading } = useAdminListUsers();
  const updateUser = useAdminUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggleRole = (id: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    updateUser.mutate({ id, data: { role: newRole as "admin" | "member" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        toast({ title: `Role updated to ${newRole}` });
      },
    });
  };

  const handleToggleBan = (id: number, isBanned: boolean) => {
    if (!confirm(`${isBanned ? "Unban" : "Ban"} this user?`)) return;
    updateUser.mutate({ id, data: { isBanned: !isBanned } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        toast({ title: isBanned ? "User unbanned" : "User banned" });
      },
    });
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Members" desc={`${(data ?? []).length} registered members`} />
      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Username</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Role</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Posts</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Threads</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).map(user => (
              <TableRow key={user.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="font-mono text-sm font-semibold">{user.username}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none text-[10px] uppercase font-mono px-2 py-0 ${user.role === "admin" ? "border-primary/50 text-primary bg-primary/10" : "border-border/50 text-muted-foreground"}`}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{user.postCount}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{user.threadCount}</TableCell>
                <TableCell>
                  {user.isBanned ? (
                    <span className="font-mono text-[10px] uppercase text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />Banned</span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Active</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleToggleRole(user.id, user.role)} title={user.role === "admin" ? "Remove admin" : "Make admin"} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary">
                      <Shield className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleBan(user.id, user.isBanned)} title={user.isBanned ? "Unban" : "Ban"} className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive">
                      {user.isBanned ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────

type CatForm = { slug: string; name: string; description: string; icon: string; sortOrder: string };
const emptyCatForm = (): CatForm => ({ slug: "", name: "", description: "", icon: "", sortOrder: "10" });

function CategoriesTab() {
  const { data, isLoading } = useListCategories();
  const createCat = useAdminCreateCategory();
  const updateCat = useAdminUpdateCategory();
  const deleteCat = useAdminDeleteCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CatForm>(emptyCatForm());

  const setName = (name: string) => setForm(f => ({ ...f, name, slug: editId ? f.slug : toSlug(name) }));

  const openCreate = () => { setForm(emptyCatForm()); setEditId(null); setOpen(true); };
  const openEdit = (c: { id: number; slug: string; name: string; description: string; icon: string | null; sortOrder: number }) => {
    setEditId(c.id);
    setForm({ slug: c.slug, name: c.name, description: c.description, icon: c.icon ?? "", sortOrder: String(c.sortOrder) });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    const payload = { slug: form.slug, name: form.name, description: form.description, icon: form.icon || null, sortOrder: parseInt(form.sortOrder) || 10 };
    if (editId !== null) {
      updateCat.mutate({ id: editId, data: payload }, {
        onSuccess: () => { setOpen(false); queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); toast({ title: "Category updated" }); },
        onError: (e: unknown) => toast({ title: "Error", description: (e as Error)?.message ?? "Could not update", variant: "destructive" }),
      });
    } else {
      createCat.mutate({ data: payload }, {
        onSuccess: () => { setOpen(false); queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); toast({ title: "Category created" }); },
        onError: (e: unknown) => toast({ title: "Error", description: (e as Error)?.message ?? "Could not create", variant: "destructive" }),
      });
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Forum Categories"
        desc="Create and manage forum categories. Threads are organized under categories."
        action={<Button onClick={openCreate} className="font-mono text-xs uppercase tracking-wide rounded-none"><Plus className="w-4 h-4 mr-1.5" /> New Category</Button>}
      />

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-lg">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase text-base">{editId ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Category Name <span className="text-destructive">*</span></label>
              <Input value={form.name} onChange={e => setName(e.target.value)} className="rounded-none font-mono" placeholder="e.g. Trip Reports" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">URL Slug <span className="text-destructive">*</span></label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="auto-generated from name" />
              <p className="font-mono text-[10px] text-muted-foreground">Used in URLs: /category/<strong>{form.slug || "slug"}</strong></p>
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-none font-mono text-sm" rows={2} placeholder="Short description shown on forum home" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Icon Name</label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="e.g. compass" />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Sort Order</label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="rounded-none font-mono text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-none font-mono text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={createCat.isPending || updateCat.isPending || !form.name.trim()} className="rounded-none font-mono text-xs uppercase">
              {editId ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Slug</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Threads</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Posts</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 font-mono text-xs text-muted-foreground">No categories yet.</TableCell></TableRow>
            ) : (data ?? []).map(cat => (
              <TableRow key={cat.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="font-mono text-sm font-semibold">{cat.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{cat.slug}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{cat.threadCount}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{cat.postCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${cat.name}"? All threads will be removed.`)) deleteCat.mutate({ id: cat.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); toast({ title: "Deleted" }); } }); }} className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── States / Sectors ──────────────────────────────────────────────────────────

type StateForm = { slug: string; name: string; abbreviation: string; centerLat: string; centerLng: string; zoom: string };
const emptyStateForm = (): StateForm => ({ slug: "", name: "", abbreviation: "", centerLat: "39.5", centerLng: "-98.35", zoom: "6" });

// US state center coordinates lookup
const US_CENTERS: Record<string, { lat: number; lng: number; abbr: string }> = {
  "alabama": { lat: 32.8, lng: -86.8, abbr: "AL" }, "alaska": { lat: 64.2, lng: -153.4, abbr: "AK" },
  "arizona": { lat: 34.0, lng: -111.1, abbr: "AZ" }, "arkansas": { lat: 34.8, lng: -92.2, abbr: "AR" },
  "california": { lat: 36.8, lng: -119.4, abbr: "CA" }, "colorado": { lat: 39.6, lng: -105.8, abbr: "CO" },
  "connecticut": { lat: 41.6, lng: -72.7, abbr: "CT" }, "delaware": { lat: 38.9, lng: -75.5, abbr: "DE" },
  "florida": { lat: 27.8, lng: -81.7, abbr: "FL" }, "georgia": { lat: 33.0, lng: -83.6, abbr: "GA" },
  "hawaii": { lat: 20.8, lng: -156.3, abbr: "HI" }, "idaho": { lat: 44.1, lng: -114.7, abbr: "ID" },
  "illinois": { lat: 40.0, lng: -89.2, abbr: "IL" }, "indiana": { lat: 40.3, lng: -86.1, abbr: "IN" },
  "iowa": { lat: 42.0, lng: -93.2, abbr: "IA" }, "kansas": { lat: 38.5, lng: -98.4, abbr: "KS" },
  "kentucky": { lat: 37.7, lng: -84.9, abbr: "KY" }, "louisiana": { lat: 31.2, lng: -91.8, abbr: "LA" },
  "maine": { lat: 44.7, lng: -69.4, abbr: "ME" }, "maryland": { lat: 39.0, lng: -76.6, abbr: "MD" },
  "massachusetts": { lat: 42.2, lng: -71.5, abbr: "MA" }, "michigan": { lat: 44.3, lng: -85.6, abbr: "MI" },
  "minnesota": { lat: 46.4, lng: -93.1, abbr: "MN" }, "mississippi": { lat: 32.7, lng: -89.7, abbr: "MS" },
  "missouri": { lat: 38.5, lng: -92.3, abbr: "MO" }, "montana": { lat: 46.9, lng: -110.4, abbr: "MT" },
  "nebraska": { lat: 41.5, lng: -99.9, abbr: "NE" }, "nevada": { lat: 38.8, lng: -116.4, abbr: "NV" },
  "new hampshire": { lat: 43.2, lng: -71.6, abbr: "NH" }, "new jersey": { lat: 40.1, lng: -74.4, abbr: "NJ" },
  "new mexico": { lat: 34.5, lng: -105.9, abbr: "NM" }, "new york": { lat: 42.2, lng: -74.9, abbr: "NY" },
  "north carolina": { lat: 35.6, lng: -79.8, abbr: "NC" }, "north dakota": { lat: 47.4, lng: -100.5, abbr: "ND" },
  "ohio": { lat: 40.4, lng: -82.9, abbr: "OH" }, "oklahoma": { lat: 35.6, lng: -96.9, abbr: "OK" },
  "oregon": { lat: 43.8, lng: -120.6, abbr: "OR" }, "pennsylvania": { lat: 41.2, lng: -77.2, abbr: "PA" },
  "rhode island": { lat: 41.7, lng: -71.5, abbr: "RI" }, "south carolina": { lat: 33.8, lng: -80.9, abbr: "SC" },
  "south dakota": { lat: 44.3, lng: -99.4, abbr: "SD" }, "tennessee": { lat: 35.7, lng: -86.7, abbr: "TN" },
  "texas": { lat: 31.1, lng: -97.6, abbr: "TX" }, "utah": { lat: 39.3, lng: -111.1, abbr: "UT" },
  "vermont": { lat: 44.0, lng: -72.7, abbr: "VT" }, "virginia": { lat: 37.8, lng: -78.2, abbr: "VA" },
  "washington": { lat: 47.4, lng: -120.5, abbr: "WA" }, "west virginia": { lat: 38.5, lng: -80.9, abbr: "WV" },
  "wisconsin": { lat: 44.3, lng: -89.6, abbr: "WI" }, "wyoming": { lat: 43.1, lng: -107.6, abbr: "WY" },
};

function StatesTab() {
  const { data, isLoading } = useListStates();
  const createState = useAdminCreateState();
  const updateState = useAdminUpdateState();
  const deleteState = useAdminDeleteState();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<StateForm>(emptyStateForm());
  const [error, setError] = useState("");

  const setName = (name: string) => {
    const slug = editId ? form.slug : toSlug(name);
    const lower = name.toLowerCase();
    const known = US_CENTERS[lower];
    setForm(f => ({
      ...f, name, slug,
      abbreviation: editId ? f.abbreviation : (known?.abbr ?? f.abbreviation),
      centerLat: editId ? f.centerLat : (known ? String(known.lat) : f.centerLat),
      centerLng: editId ? f.centerLng : (known ? String(known.lng) : f.centerLng),
    }));
  };

  const openCreate = () => { setForm(emptyStateForm()); setEditId(null); setError(""); setOpen(true); };
  const openEdit = (s: { id: number; slug: string; name: string; abbreviation: string; centerLat: number; centerLng: number; zoom: number }) => {
    setEditId(s.id);
    setForm({ slug: s.slug, name: s.name, abbreviation: s.abbreviation, centerLat: String(s.centerLat), centerLng: String(s.centerLng), zoom: String(s.zoom) });
    setError(""); setOpen(true);
  };

  const handleSave = () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.abbreviation.trim()) { setError("Abbreviation is required (e.g. NY)."); return; }
    if (!form.slug.trim()) { setError("Slug is required."); return; }
    const lat = parseFloat(form.centerLat), lng = parseFloat(form.centerLng);
    if (isNaN(lat) || isNaN(lng)) { setError("Valid lat/lng required."); return; }

    const payload = { slug: form.slug, name: form.name, abbreviation: form.abbreviation.toUpperCase(), centerLat: lat, centerLng: lng, zoom: parseInt(form.zoom) || 6 };

    if (editId !== null) {
      updateState.mutate({ id: editId, data: payload }, {
        onSuccess: () => { setOpen(false); queryClient.invalidateQueries({ queryKey: getListStatesQueryKey() }); toast({ title: `${form.name} updated` }); },
        onError: (e: unknown) => setError((e as Error)?.message ?? "Could not update sector"),
      });
    } else {
      createState.mutate({ data: payload }, {
        onSuccess: () => { setOpen(false); queryClient.invalidateQueries({ queryKey: getListStatesQueryKey() }); toast({ title: `${form.name} sector added` }); },
        onError: (e: unknown) => setError((e as Error)?.message ?? "Could not create sector"),
      });
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Geographic Sectors"
        desc={`${(data ?? []).length} US states mapped — each sector has a map and can hold logged locations`}
        action={<Button onClick={openCreate} className="font-mono text-xs uppercase tracking-wide rounded-none"><Plus className="w-4 h-4 mr-1.5" /> Add Sector</Button>}
      />

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-widest uppercase text-base">{editId ? "Edit Sector" : "Add New Sector"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">State Name <span className="text-destructive">*</span></label>
                <Input value={form.name} onChange={e => setName(e.target.value)} className="rounded-none font-mono" placeholder="e.g. Illinois" autoFocus />
                <p className="font-mono text-[10px] text-muted-foreground">Type a US state name to auto-fill coords & abbr.</p>
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Abbr. <span className="text-destructive">*</span></label>
                <Input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value.toUpperCase().slice(0, 2) }))} className="rounded-none font-mono text-center text-lg font-bold" placeholder="IL" maxLength={2} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">URL Slug <span className="text-destructive">*</span></label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="auto-generated" />
              <p className="font-mono text-[10px] text-muted-foreground">Used in URLs: /state/<strong>{form.slug || "slug"}</strong></p>
            </div>

            <div className="p-3 bg-muted/20 border border-border/30 space-y-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Map Center Coordinates</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Latitude</label>
                  <Input type="number" step="0.01" value={form.centerLat} onChange={e => setForm(f => ({ ...f, centerLat: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="39.50" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Longitude</label>
                  <Input type="number" step="0.01" value={form.centerLng} onChange={e => setForm(f => ({ ...f, centerLng: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="-98.35" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground">Zoom</label>
                  <Input type="number" min={4} max={14} value={form.zoom} onChange={e => setForm(f => ({ ...f, zoom: e.target.value }))} className="rounded-none font-mono text-sm" />
                </div>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">These set where the map is centered when viewing this sector. Auto-filled for US states.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-none font-mono text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={createState.isPending || updateState.isPending} className="rounded-none font-mono text-xs uppercase">
              {editId ? "Save Changes" : "Add Sector"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">State</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Slug</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Center</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Locations</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 font-mono text-xs text-muted-foreground">No sectors yet. Click "Add Sector" above.</TableCell></TableRow>
            ) : (data ?? []).map(s => (
              <TableRow key={s.id} className="border-border/30 hover:bg-muted/10">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[11px] text-primary font-mono shrink-0">
                      {s.abbreviation}
                    </div>
                    <span className="font-mono text-sm font-semibold">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">{s.centerLat.toFixed(1)}, {s.centerLng.toFixed(1)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] border-border/50">
                    {s.locationCount} sites
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remove "${s.name}" sector?`)) deleteState.mutate({ id: s.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListStatesQueryKey() }); toast({ title: "Sector removed" }); } }); }} className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Locations ─────────────────────────────────────────────────────────────────

function LocationsTab() {
  const { data, isLoading } = useListLocations();
  const updateLoc = useAdminUpdateLocation();
  const deleteLoc = useAdminDeleteLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", city: "", status: "active", risk: "medium" });

  const openEdit = (l: { id: number; name: string; description: string; city: string | null; status: string; risk: string }) => {
    setEditId(l.id);
    setForm({ name: l.name, description: l.description, city: l.city ?? "", status: l.status, risk: l.risk });
  };

  const handleSave = () => {
    if (editId === null) return;
    updateLoc.mutate({ id: editId, data: { name: form.name, description: form.description, city: form.city || null, status: form.status as "active" | "demolished" | "sealed" | "watched", risk: form.risk as "low" | "medium" | "high" | "extreme" } }, {
      onSuccess: () => {
        setEditId(null);
        queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
        toast({ title: "Location updated" });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const STATUS_BADGE: Record<string, string> = {
    active: "border-green-500/40 text-green-500 bg-green-500/5",
    demolished: "border-destructive/40 text-destructive bg-destructive/5",
    sealed: "border-yellow-500/40 text-yellow-500 bg-yellow-500/5",
    watched: "border-orange-500/40 text-orange-500 bg-orange-500/5",
  };
  const RISK_BADGE: Record<string, string> = {
    low: "border-green-500/40 text-green-500", medium: "border-yellow-500/40 text-yellow-500",
    high: "border-orange-500/40 text-orange-500", extreme: "border-destructive/40 text-destructive",
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Logged Locations" desc={`${(data ?? []).length} total locations across all sectors`} />

      <Dialog open={editId !== null} onOpenChange={v => { if (!v) setEditId(null); }}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-lg">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase text-base">Edit Location</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-none font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">City / Area</label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="rounded-none font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">{["active","watched","sealed","demolished"].map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Risk Level</label>
                <Select value={form.risk} onValueChange={v => setForm(f => ({ ...f, risk: v }))}>
                  <SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">{["low","medium","high","extreme"].map(r => <SelectItem key={r} value={r} className="font-mono text-xs">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Description / Notes</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-none font-mono text-sm" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditId(null)} className="rounded-none font-mono text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={updateLoc.isPending} className="rounded-none font-mono text-xs uppercase">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Location</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">State</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Risk</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 font-mono text-xs text-muted-foreground">No locations yet. Members can log sites from the Sectors page.</TableCell></TableRow>
            ) : (data ?? []).map(loc => (
              <TableRow key={loc.id} className="border-border/30 hover:bg-muted/10">
                <TableCell>
                  <div className="font-mono text-sm font-semibold">{loc.name}</div>
                  {loc.city && <div className="font-mono text-[10px] text-muted-foreground">{loc.city}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{loc.stateName}</TableCell>
                <TableCell><Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${STATUS_BADGE[loc.status] ?? ""}`}>{loc.status}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${RISK_BADGE[loc.risk] ?? ""}`}>{loc.risk}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(loc)} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${loc.name}"?`)) deleteLoc.mutate({ id: loc.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() }); toast({ title: "Deleted" }); } }); }} className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Threads ───────────────────────────────────────────────────────────────────

function ThreadsTab() {
  const { data, isLoading } = useListThreads();
  const pinThread = useAdminPinThread();
  const deleteThread = useAdminDeleteThread();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTogglePin = (id: number, isPinned: boolean) => {
    pinThread.mutate({ id, data: { isPinned: !isPinned } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey() }); toast({ title: isPinned ? "Unpinned" : "Pinned" }); },
    });
  };

  const handleToggleLock = (id: number, isLocked: boolean) => {
    customFetch(`/api/admin/threads/${id}/lock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !isLocked }),
    }).then(() => { queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey() }); toast({ title: isLocked ? "Unlocked" : "Locked" }); });
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Threads" desc="Pin, lock, or delete threads across all categories" />
      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border/50">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Author</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Category</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Flags</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 font-mono text-xs text-muted-foreground">No threads yet.</TableCell></TableRow>
            ) : (data ?? []).map(thread => (
              <TableRow key={thread.id} className="border-border/30 hover:bg-muted/10">
                <TableCell className="font-mono text-sm font-medium max-w-[200px] truncate">{thread.title}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{thread.authorUsername}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{thread.categoryName}</TableCell>
                <TableCell className="space-x-1">
                  {thread.isPinned && <Badge variant="outline" className="rounded-none border-primary/40 text-primary bg-primary/5 text-[10px] font-mono"><Pin className="w-2.5 h-2.5 mr-1 inline" />Pinned</Badge>}
                  {thread.isLocked && <Badge variant="outline" className="rounded-none border-destructive/40 text-destructive bg-destructive/5 text-[10px] font-mono"><Lock className="w-2.5 h-2.5 mr-1 inline" />Locked</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleTogglePin(thread.id, thread.isPinned)} title={thread.isPinned ? "Unpin" : "Pin"} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary">
                      {thread.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleLock(thread.id, thread.isLocked)} title={thread.isLocked ? "Unlock" : "Lock"} className="h-8 w-8 rounded-none hover:bg-yellow-500/20 hover:text-yellow-500">
                      {thread.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete thread and all posts?")) deleteThread.mutate({ id: thread.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey() }); toast({ title: "Thread deleted" }); } }); }} className="h-8 w-8 rounded-none hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Chat Rooms ────────────────────────────────────────────────────────────────

type AdminChatRoom = { id: number; slug: string; name: string; description: string; kind: string; minTrustLevel: number; isArchived: boolean; memberCount: number; messageCount: number; createdAt: string };
type RoomBan = { id: number; roomSlug: string | null; roomName: string | null; userId: number; username: string | null; bannedUntil: string | null; reason: string; createdAt: string };

function ChatRoomsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rooms, isLoading } = useQuery<AdminChatRoom[]>({ queryKey: ["admin-chat-rooms"], queryFn: () => customFetch<AdminChatRoom[]>("/api/admin/chat/rooms") });
  const { data: bans } = useQuery<RoomBan[]>({ queryKey: ["admin-chat-bans"], queryFn: () => customFetch<RoomBan[]>("/api/admin/chat/bans") });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", kind: "public", minTrust: "0" });
  const [editRoom, setEditRoom] = useState<AdminChatRoom | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", kind: "public", minTrust: "0" });
  const [busy, setBusy] = useState(false);

  const setCreateName = (name: string) => setForm(f => ({ ...f, name, slug: toSlug(name) }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await customFetch("/api/chat/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, slug: form.slug, description: form.description, kind: form.kind, minTrustLevel: parseInt(form.minTrust) }) });
      setCreateOpen(false); setForm({ name: "", slug: "", description: "", kind: "public", minTrust: "0" });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-rooms"] });
      toast({ title: "Room created" });
    } catch { toast({ title: "Error", description: "Could not create room", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const openEdit = (r: AdminChatRoom) => { setEditRoom(r); setEditForm({ name: r.name, description: r.description, kind: r.kind, minTrust: String(r.minTrustLevel) }); };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editRoom) return; setBusy(true);
    try {
      await customFetch(`/api/chat/rooms/${editRoom.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editForm.name, description: editForm.description, minTrustLevel: parseInt(editForm.minTrust), kind: editForm.kind }) });
      setEditRoom(null); queryClient.invalidateQueries({ queryKey: ["admin-chat-rooms"] }); toast({ title: "Room updated" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const toggleArchive = async (r: AdminChatRoom) => {
    await customFetch(`/api/chat/rooms/${r.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived: !r.isArchived }) });
    queryClient.invalidateQueries({ queryKey: ["admin-chat-rooms"] });
    toast({ title: r.isArchived ? "Room restored" : "Room archived" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chat Rooms"
        desc="Manage public chat rooms. Crew rooms are managed by crew admins."
        action={<Button onClick={() => setCreateOpen(true)} className="font-mono text-xs uppercase tracking-wide rounded-none"><Plus className="w-4 h-4 mr-1.5" /> New Room</Button>}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-md">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase text-base">Create Chat Room</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Room Name</label>
              <Input value={form.name} onChange={e => setCreateName(e.target.value)} className="rounded-none font-mono" placeholder="e.g. General Discussion" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Slug</label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="rounded-none font-mono text-sm" placeholder="auto-generated" required />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase text-muted-foreground">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-none font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Type</label>
                <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                  <SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="trusted">Trusted Only</SelectItem><SelectItem value="location">Location Room</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Min Trust</label>
                <Select value={form.minTrust} onValueChange={v => setForm(f => ({ ...f, minTrust: v }))}>
                  <SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>Level {n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-none font-mono text-xs">Cancel</Button>
              <Button type="submit" disabled={busy} className="rounded-none font-mono text-xs uppercase">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRoom} onOpenChange={o => { if (!o) setEditRoom(null); }}>
        <DialogContent className="rounded-none border-border/50 bg-card max-w-md">
          <DialogHeader><DialogTitle className="font-serif tracking-widest uppercase text-base">Edit #{editRoom?.slug}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3 py-2">
            <div className="space-y-1.5"><label className="font-mono text-xs uppercase text-muted-foreground">Name</label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="rounded-none font-mono" required /></div>
            <div className="space-y-1.5"><label className="font-mono text-xs uppercase text-muted-foreground">Description</label><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="rounded-none font-mono text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="font-mono text-xs uppercase text-muted-foreground">Type</label><Select value={editForm.kind} onValueChange={v => setEditForm(f => ({ ...f, kind: v }))}><SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="trusted">Trusted Only</SelectItem><SelectItem value="location">Location</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><label className="font-mono text-xs uppercase text-muted-foreground">Min Trust</label><Select value={editForm.minTrust} onValueChange={v => setEditForm(f => ({ ...f, minTrust: v }))}><SelectTrigger className="rounded-none font-mono text-xs"><SelectValue /></SelectTrigger><SelectContent>{[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>Level {n}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setEditRoom(null)} className="rounded-none font-mono text-xs">Cancel</Button><Button type="submit" disabled={busy} className="rounded-none font-mono text-xs uppercase">Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rooms table */}
      <div className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/30 border-border/50">
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Room</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Messages</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
            : (rooms ?? []).map(r => (
              <TableRow key={r.id} className={`border-border/30 hover:bg-muted/10 ${r.isArchived ? "opacity-50" : ""}`}>
                <TableCell><div className="font-mono text-sm font-semibold">{r.name}</div><div className="font-mono text-[10px] text-muted-foreground">#{r.slug}</div></TableCell>
                <TableCell><Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-border/50">{r.kind}</Badge></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.messageCount}</TableCell>
                <TableCell><Badge variant={r.isArchived ? "secondary" : "outline"} className="rounded-none font-mono text-[10px] uppercase">{r.isArchived ? "Archived" : "Active"}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex items-center gap-1 justify-end">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8 rounded-none hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleArchive(r)} title={r.isArchived ? "Restore" : "Archive"} className="h-8 w-8 rounded-none hover:bg-muted/40">{r.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}</Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bans */}
      {(bans ?? []).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-base text-foreground tracking-widest uppercase flex items-center gap-2"><UserX className="w-4 h-4 text-destructive" /> Active Bans</h3>
          <div className="border border-border/50 overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/30 border-border/50">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">User</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Room</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Expires</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bans?.map(ban => (
                  <TableRow key={ban.id} className="border-border/30">
                    <TableCell className="font-mono text-xs">{ban.username}</TableCell>
                    <TableCell className="font-mono text-xs">#{ban.roomSlug}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ban.bannedUntil ? new Date(ban.bannedUntil).toLocaleString() : "Permanent"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={async () => { await customFetch(`/api/admin/chat/bans/${ban.id}`, { method: "DELETE" }); queryClient.invalidateQueries({ queryKey: ["admin-chat-bans"] }); toast({ title: "Ban lifted" }); }} className="h-7 rounded-none font-mono text-[10px] uppercase hover:bg-green-500/20 hover:text-green-400">Lift Ban</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Noticeboard ───────────────────────────────────────────────────────────────

type AdminNotice = { id: number; title: string; body: string; authorUsername: string | null; isPinned: boolean; createdAt: string };

function NoticeboardTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [sending, setSending] = useState(false);
  const { data: notices, isLoading } = useQuery<AdminNotice[]>({ queryKey: ["admin-notices"], queryFn: () => customFetch<AdminNotice[]>("/api/admin/notices") });

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault(); if (!title.trim()) return; setSending(true);
    try { await customFetch("/api/admin/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body }) }); setTitle(""); setBody(""); queryClient.invalidateQueries({ queryKey: ["admin-notices"] }); toast({ title: "Notice posted" }); }
    catch { toast({ title: "Error", variant: "destructive" }); } finally { setSending(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader title="Admin Noticeboard" desc="Internal notices visible to admins only. Pin important items." />
      <form onSubmit={handlePost} className="space-y-3 border border-border/50 bg-card/30 p-4">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notice title..." className="font-mono rounded-none bg-background/50 font-semibold" required />
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Body (optional)..." rows={3} className="font-mono rounded-none bg-background/50 text-sm" />
        <Button type="submit" disabled={sending} size="sm" className="font-mono text-xs uppercase tracking-wide rounded-none">
          <Plus className="w-4 h-4 mr-1.5" />{sending ? "Posting..." : "Post Notice"}
        </Button>
      </form>
      <div className="space-y-3">
        {isLoading ? [1,2].map(i => <Skeleton key={i} className="h-20 w-full" />) : !(notices ?? []).length ? (
          <div className="font-mono text-xs text-muted-foreground italic p-4 border border-border/30">No notices yet.</div>
        ) : notices?.map(notice => (
          <div key={notice.id} className={`border p-4 space-y-2 ${notice.isPinned ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card/20"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">{notice.isPinned && <Pin className="w-3.5 h-3.5 text-primary shrink-0" />}<span className="font-medium text-foreground">{notice.title}</span></div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={async () => { await customFetch(`/api/admin/notices/${notice.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPinned: !notice.isPinned }) }); queryClient.invalidateQueries({ queryKey: ["admin-notices"] }); }} className="h-7 w-7 rounded-none hover:bg-primary/10 hover:text-primary">{notice.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}</Button>
                <Button variant="ghost" size="icon" onClick={async () => { if (!confirm("Delete?")) return; await customFetch(`/api/admin/notices/${notice.id}`, { method: "DELETE" }); queryClient.invalidateQueries({ queryKey: ["admin-notices"] }); }} className="h-7 w-7 rounded-none hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            {notice.body && <p className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">{notice.body}</p>}
            <div className="font-mono text-[10px] text-muted-foreground">{notice.authorUsername} · {new Date(notice.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Guidelines ────────────────────────────────────────────────────────────────

function GuidelinesTab() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["site-settings"], queryFn: () => customFetch<{ guidelines: string; rules: string; welcome_message: string }>("/api/settings") });
  const [guidelines, setGuidelines] = useState(""); const [rules, setRules] = useState(""); const [welcome, setWelcome] = useState(""); const [loaded, setLoaded] = useState(false); const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loaded && data) { setGuidelines(data.guidelines || ""); setRules(data.rules || ""); setWelcome(data.welcome_message || ""); setLoaded(true); } }, [data, loaded]);

  const handleSave = async () => {
    setSaving(true);
    try { await customFetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guidelines, rules, welcome_message: welcome }) }); await refetch(); toast({ title: "Saved successfully" }); }
    catch { toast({ title: "Error", description: "Could not save", variant: "destructive" }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader title="Site Content" desc="Edit the welcome message and community guidelines shown to members." />
      {isLoading ? <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div> : (
        <>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Welcome Message</label>
            <Textarea value={welcome} onChange={e => setWelcome(e.target.value)} rows={3} className="rounded-none font-mono text-sm bg-background/50" placeholder="Shown at the top of the forum home page..." />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Community Guidelines</label>
            <Textarea value={guidelines} onChange={e => setGuidelines(e.target.value)} rows={8} className="rounded-none font-mono text-sm bg-background/50" placeholder="Community guidelines and code of conduct..." />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Operational Rules</label>
            <Textarea value={rules} onChange={e => setRules(e.target.value)} rows={5} className="rounded-none font-mono text-sm bg-background/50" placeholder="Field rules, location protocol, security guidelines..." />
          </div>
          <Button onClick={handleSave} disabled={saving} className="font-mono text-xs uppercase tracking-wide rounded-none">
            <Settings className="w-4 h-4 mr-1.5" />{saving ? "Saving..." : "Save Content"}
          </Button>
        </>
      )}
    </div>
  );
}
