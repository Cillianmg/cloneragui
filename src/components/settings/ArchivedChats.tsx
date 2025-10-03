import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ArchivedChats = () => {
  const [archivedChats, setArchivedChats] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadArchivedChats();
  }, []);

  const loadArchivedChats = async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("is_archived", true)
      .order("archived_at", { ascending: false });

    if (error) {
      toast.error("Failed to load archived chats");
    } else {
      setArchivedChats(data || []);
    }
  };

  const restoreChat = async (chatId: string) => {
    const { error } = await supabase
      .from("chats")
      .update({ is_archived: false, archived_at: null })
      .eq("id", chatId);

    if (error) {
      toast.error("Failed to restore chat");
    } else {
      toast.success("Chat restored");
      loadArchivedChats();
    }
  };

  const permanentlyDelete = async () => {
    if (!chatToDelete) return;

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatToDelete);

    if (error) {
      toast.error("Failed to delete chat");
    } else {
      toast.success("Chat permanently deleted");
      setDeleteDialogOpen(false);
      setChatToDelete(null);
      loadArchivedChats();
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Archived Chats</CardTitle>
          <CardDescription>
            Restore or permanently delete your archived chats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {archivedChats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived chats</p>
          ) : (
            archivedChats.map((chat) => (
              <div
                key={chat.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Archived {new Date(chat.archived_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreChat(chat.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setChatToDelete(chat.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat
              and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={permanentlyDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
