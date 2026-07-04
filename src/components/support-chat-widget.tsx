import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send } from "lucide-react";
import { toast } from "sonner";

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

/**
 * Floating support-chat widget for regular users.
 * - User sends messages with receiver_id = NULL ("to admins").
 * - Admin replies come back with receiver_id = user.id.
 * - Realtime subscription keeps the thread live.
 */
export function SupportChatWidget() {
  const isAdmin = useIsSuperAdmin();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Load thread history for this user
  const historyQ = useQuery({
    queryKey: ["support_messages_self", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, sender_id, receiver_id, message, created_at")
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    if (historyQ.data) setMessages(historyQ.data);
  }, [historyQ.data]);

  // Realtime: listen for new rows relevant to me
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`support:${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const row = payload.new as Msg;
          if (row.sender_id === uid || row.receiver_id === uid) {
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row],
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const unread = useMemo(
    () => messages.filter((m) => m.receiver_id === uid && !m).length, // placeholder
    [messages, uid],
  );

  async function send() {
    if (!uid || !text.trim()) return;
    const msg = text.trim();
    setText("");
    const { error } = await supabase
      .from("support_messages")
      .insert({ sender_id: uid, receiver_id: null, message: msg });
    if (error) {
      toast.error(error.message);
      setText(msg);
    }
  }

  // Don't render on admin accounts — they use the /admin-support page.
  if (isAdmin.data) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-80 sm:w-96 h-[28rem] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground">
            <div className="text-sm font-semibold">Support Chat</div>
            <button onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30"
          >
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-6">
                Start a conversation with our support team.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === uid;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border"
                    }`}
                  >
                    {m.message}
                    <div className={`text-[10px] mt-1 opacity-70`}>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            className="flex items-center gap-2 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9" disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="relative h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
