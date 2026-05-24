import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";

import {
  customFetch,
  useGetCurrentUser,
} from "@workspace/api-client-react";

import { useQuery } from "@tanstack/react-query";

import {
  Users,
  Plus,
  Send,
  Shield,
  Edit2,
  Calendar,
  MapPin,
  UserPlus,
  Heart,
  ChevronDown,
  ChevronRight,
  Circle,
  Radio,
  Image as ImageIcon,
  Bell,
  Flame,
  Lock,
} from "lucide-react";

import { formatDistanceToNow, format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";

/* =========================================================
   SOCKET
========================================================= */

const socket: Socket = io(
  import.meta.env.VITE_API_URL ?? window.location.origin,
  {
    transports: ["websocket"],
  },
);

/* =========================================================
   TYPES
========================================================= */

type CrewRole =
  | "founder"
  | "co_leader"
  | "scout"
  | "medic"
  | "navigator"
  | "archivist"
  | "member";

type CrewMember = {
  userId: number;
  username: string;
  trustLevel: number;
  role: CrewRole;
  joinedAt: string;
  latitude?: number;
  longitude?: number;
  lastCheckinAt?: string;
  unreadCount?: number;
};

type Crew = {
  id: number;
  name: string;
  description: string;

  creatorId: number;
  creatorUsername: string;

  roomId: number;

  memberCount: number;

  members: CrewMember[];

  meetupAt: string | null;
  meetupNote: string | null;

  meetupLatitude?: number;
  meetupLongitude?: number;

  createdAt: string;
};

type RoomMessage = {
  id: number;

  body: string;

  authorId: number;
  authorUsername: string;

  authorTrustLevel: number;

  createdAt: string;

  likeCount: number;
  likedByMe: boolean;

  channel?: string;

  imageUrl?: string;

  disappearing?: boolean;
  expiresAt?: string | null;
};

type LocationResult = {
  id: number;
  name: string;
  city: string | null;
  stateName: string | null;
};

type OnlineUser = {
  id: number;
  username: string;
  role: string;
};

/* =========================================================
   HELPERS
========================================================= */

const ROLE_COLORS: Record<CrewRole, string> = {
  founder: "#e8760a",
  co_leader: "#d89a3d",
  scout: "#4a90d9",
  medic: "#2baa4b",
  navigator: "#9b59b6",
  archivist: "#c16fff",
  member: "#7f8c9d",
};

function renderBody(body: string) {
  const parts = body.split(
    /(\[loc:\d+:[^\]]+\]|\[image:[^\]]+\])/g,
  );

  return (
    <>
      {parts.map((part, i) => {
        const locMatch = part.match(
          /^\[loc:(\d+):([^\]]+)\]$/,
        );

        if (locMatch) {
          const href = `/location/${locMatch[1]}`;

          return (
            <a
              key={i}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = href;
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px",
                margin: "0 2px",
                borderRadius: 4,
                border: "1px solid rgba(232,118,10,0.3)",
                background: "rgba(232,118,10,0.08)",
                color: "#e8760a",
                fontSize: 11,
                textDecoration: "none",
              }}
            >
              <MapPin size={11} />
              {locMatch[2]}
            </a>
          );
        }

        const imageMatch = part.match(
          /^\[image:([^\]]+)\]$/,
        );

        if (imageMatch) {
          return (
            <div key={i} style={{ marginTop: 8 }}>
              <img
                src={imageMatch[1]}
                alt=""
                style={{
                  maxWidth: 320,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </div>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function useOnlineUsers() {
  return useQuery({
    queryKey: ["crews-online"],

    queryFn: () =>
      customFetch<{
        count: number;
        users: OnlineUser[];
      }>("/api/online"),

    refetchInterval: 20000,
  });
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selected, setSelected] =
    useState<Crew | null>(null);

  const { data: user } = useGetCurrentUser();

  const [, navigate] = useLocation();

  const { data: onlineData } = useOnlineUsers();

  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const [memberInput, setMemberInput] =
    useState("");

  const [crewsOpen, setCrewsOpen] =
    useState(true);

  const [membersOpen, setMembersOpen] =
    useState(true);

  const typedUser =
    user as (typeof user & {
      trustLevel?: number;
    }) | null;

  const onlineIds = useMemo(
    () =>
      new Set(
        (onlineData?.users ?? []).map((u) => u.id),
      ),
    [onlineData],
  );

  async function reload() {
    try {
      const data = await customFetch<Crew[]>(
        "/api/crews",
      );

      const list = Array.isArray(data)
        ? data
        : [];

      setCrews(list);

      if (selected) {
        const updated = list.find(
          (x) => x.id === selected.id,
        );

        if (updated) {
          setSelected(updated);
        }
      } else if (list.length > 0) {
        setSelected(list[0]);
      }
    } catch {
      toast({
        title: "Failed to load crews",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function createCrew(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      const usernames = memberInput
        .split(/[, ]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const created =
        await customFetch<Crew>("/api/crews", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name,
            description,
            memberUsernames: usernames,
          }),
        });

      setOpen(false);

      setName("");
      setDescription("");
      setMemberInput("");

      setCrews((prev) => [created, ...prev]);

      setSelected(created);

      toast({
        title: "Crew formed",
      });
    } catch {
      toast({
        title: "Failed to create crew",
        variant: "destructive",
      });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 118px)",
        overflow: "hidden",
        borderRadius: 10,
        background: "#111827",
        border:
          "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* SIDEBAR */}

      <div
        style={{
          width: 280,
          background:
            "linear-gradient(180deg,#0f172a 0%,#111827 100%)",
          borderRight:
            "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            padding: 14,
            borderBottom:
              "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
             