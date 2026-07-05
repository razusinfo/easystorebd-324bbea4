import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminListUsers } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin-support")({
  component: AdminSupportPage,
});

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

type UserInfo = { user_id: string; email: string; full_name: string | null };

function AdminSupportPage() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? null));
  }, []);

  const historyQ = useQuery({
    queryKey: ["support_messages_all"],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, sender_id, receiver_id, message, created_at")
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const usersQ = useQuery({
    queryKey: ["support_users_list"],
    queryFn: async (): Promise<UserInfo[]> => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []).map((u) => ({
        user_id: u.user_id,
        email: u.email,
        full_name: u.full_name,
      }));
    },
  });

  useEffect(() => {
    if (historyQ.data) setMessages(historyQ.data);
  }, [historyQ.data]);

  // Realtime: any new support message
  useEffect(() => {
    const channel = supabase
      .channel("support:admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const row = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Group messages by the user (the non-admin side of each message).
  const threads = useMemo(() => {
    const map = new Map<string, Msg[]>();
    for (const m of messages) {
      // The user in the thread is whoever isn't the admin.
      // - Inbound user->admin messages: sender_id = user, receiver_id = null
      // - Admin replies: sender_id = admin, receiver_id = user
      const userId = m.receiver_id ?? m.sender_id;
      if (!userId) continue;
      const arr = map.get(userId) ?? [];
      arr.push(m);
      map.set(userId, arr);
    }
    return Array.from(map.entries())
      .map(([uid, msgs]) => ({
        user_id: uid,
        messages: msgs,
        last: msgs[msgs.length - 1],
      }))
      .sort(
        (a, b) =>
          new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
      );
  }, [messages]);

  const userMap = useMemo(() => {
    const m = new Map<string, UserInfo>();
    for (const u of usersQ.data ?? []) m.set(u.user_id, u);
    return m;
  }, [usersQ.data]);

  useEffect(() => {
    if (!activeUser && threads.length > 0) setActiveUser(threads[0].user_id);
  }, [threads, activeUser]);

  const activeMsgs = useMemo(
    () => threads.find((t) => t.user_id === activeUser)?.messages ?? [],
    [threads, activeUser],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeMsgs.length, activeUser]);

  async function reply() {
    if (!adminId || !activeUser || !text.trim()) return;
    const msg = text.trim();
    setText("");
    const { error } = await supabase
      .from("support_messages")
      .insert({ sender_id: adminId, receiver_id: activeUser, message: msg });
    if (error) {
      toast.error(error.message);
      setText(msg);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Support Messages</h1>
        <p className="text-sm text-muted-foreground">
          Real-time messages from users. Click a thread to reply.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[70vh]">
        <Card className="overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No messages yet.</div>
          ) : (
            <ul className="divide-y">
              {threads.map((t) => {
                const info = userMap.get(t.user_id);
                const label = info?.full_name || info?.email || t.user_id.slice(0, 8);
                return (
                  <li key={t.user_id}>
                    <button
                      onClick={() => setActiveUser(t.user_id)}
                      className={`w-full text-left px-3 py-2 hover:bg-accent ${
                        activeUser === t.user_id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="font-medium text-sm truncate">{label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.last.message}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(t.last.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {!activeUser ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="border-b px-3 py-2 text-sm font-medium">
                {(() => {
                  const info = userMap.get(activeUser);
                  return info?.full_name || info?.email || activeUser;
                })()}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
                {activeMsgs.map((m) => {
                  const fromAdmin = m.sender_id === adminId;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          fromAdmin
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border"
                        }`}
                      >
                        {m.message}
                        <div className="text-[10px] mt-1 opacity-70">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void reply();
                }}
                className="border-t p-2 flex items-center gap-2"
              >
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Reply…"
                  autoFocus
                />
                <Button type="submit" size="icon" disabled={!text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
