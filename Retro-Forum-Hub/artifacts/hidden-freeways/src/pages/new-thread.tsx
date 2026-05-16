import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListCategories, useListStates, useGetStateBySlug, useCreateThread, getListCategoriesQueryKey, getListStatesQueryKey, getGetStateBySlugQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Terminal, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PostEditor } from "@/components/post-toolbar";

export default function NewThread() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategoryId = searchParams.get("categoryId") ? parseInt(searchParams.get("categoryId")!) : "";
  const initialLocationId = searchParams.get("locationId") ? parseInt(searchParams.get("locationId")!) : "";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">(initialCategoryId);
  const [selectedStateSlug, setSelectedStateSlug] = useState<string>("");
  const [locationId, setLocationId] = useState<number | "">(initialLocationId);

  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: states, isLoading: loadingStates } = useListStates();
  
  const { data: stateData, isLoading: loadingStateData } = useGetStateBySlug(selectedStateSlug, {
    query: { enabled: !!selectedStateSlug, queryKey: getGetStateBySlugQueryKey(selectedStateSlug) }
  });

  const createThread = useCreateThread();

  // Only top-level categories for the dropdown
  const topCategories = categories?.filter(c => !(c as { parentId?: number }).parentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body || !categoryId) return;

    createThread.mutate({
      data: {
        title,
        body,
        categoryId: Number(categoryId),
        locationId: locationId ? Number(locationId) : null
      }
    }, {
      onSuccess: (newThread) => {
        setLocation(`/thread/${newThread.id}`);
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="border border-border/50 bg-card/40 backdrop-blur-sm p-6 md:p-8">
        <h1 className="font-serif text-3xl text-primary tracking-widest uppercase mb-2 flex items-center">
          <Terminal className="w-6 h-6 mr-3" /> Initialize Transmission
        </h1>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Broadcast intel to the network. Secure connection established.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase text-muted-foreground">Transmission Header</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 border-border font-mono rounded-none focus-visible:ring-primary/50 text-lg"
              placeholder="Designation / Subject"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Comm Channel (Required)</Label>
              {loadingCategories ? (
                <Skeleton className="h-10 w-full rounded-none" />
              ) : (
                <Select value={categoryId.toString()} onValueChange={(v) => setCategoryId(parseInt(v))}>
                  <SelectTrigger className="bg-background/50 rounded-none border-border font-mono">
                    <SelectValue placeholder="Select Channel" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-none">
                    {topCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Linked Coordinates (Optional)</Label>
              {loadingStates ? (
                <Skeleton className="h-10 w-full rounded-none" />
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedStateSlug} onValueChange={(v) => { setSelectedStateSlug(v); setLocationId(""); }}>
                    <SelectTrigger className="bg-background/50 rounded-none border-border font-mono w-[120px]">
                      <SelectValue placeholder="Sector" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-none">
                      <SelectItem value="none" className="text-muted-foreground">None</SelectItem>
                      {states?.map((s) => (
                        <SelectItem key={s.id} value={s.slug}>{s.abbreviation}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select disabled={!selectedStateSlug || selectedStateSlug === "none" || loadingStateData} value={locationId.toString()} onValueChange={(v) => setLocationId(parseInt(v))}>
                    <SelectTrigger className="bg-background/50 rounded-none border-border font-mono flex-1">
                      <SelectValue placeholder="Site" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-none">
                      {stateData?.locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                      ))}
                      {stateData?.locations.length === 0 && (
                        <SelectItem value="none" disabled>No sites in this sector</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase text-muted-foreground">Data Payload</Label>
            <PostEditor
              value={body}
              onChange={setBody}
              placeholder="Enter field notes, access details, status... Use the toolbar above to bold, italicize, embed images, etc."
              rows={12}
              required
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button
              type="submit"
              disabled={createThread.isPending}
              className="font-serif tracking-widest uppercase rounded-none w-full sm:w-auto"
            >
              <Send className="w-4 h-4 mr-2" />
              {createThread.isPending ? "Broadcasting..." : "Broadcast Intel"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
