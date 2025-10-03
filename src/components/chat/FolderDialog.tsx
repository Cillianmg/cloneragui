import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Folder, Plus } from "lucide-react";

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  onFolderSelected: () => void;
}

export const FolderDialog = ({
  open,
  onOpenChange,
  chatId,
  onFolderSelected,
}: FolderDialogProps) => {
  const [folders, setFolders] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders();
    }
  }, [open]);

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("chat_folders")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load folders");
    } else {
      setFolders(data || []);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("chat_folders")
      .insert([{ name: newFolderName.trim(), user_id: user.id }]);

    if (error) {
      toast.error("Failed to create folder");
    } else {
      toast.success("Folder created");
      setNewFolderName("");
      setShowNewFolder(false);
      loadFolders();
    }
  };

  const moveToFolder = async (folderId: string | null) => {
    const { error } = await supabase
      .from("chats")
      .update({ folder_id: folderId })
      .eq("id", chatId);

    if (error) {
      toast.error("Failed to move chat");
    } else {
      toast.success(folderId ? "Chat moved to folder" : "Chat removed from folder");
      onFolderSelected();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => moveToFolder(null)}
          >
            <Folder className="w-4 h-4 mr-2" />
            No folder
          </Button>
          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => moveToFolder(folder.id)}
            >
              <Folder className="w-4 h-4 mr-2" />
              {folder.name}
            </Button>
          ))}
        </div>
        <div className="pt-4 border-t">
          {showNewFolder ? (
            <div className="flex gap-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
              />
              <Button onClick={createFolder}>Create</Button>
              <Button variant="outline" onClick={() => setShowNewFolder(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewFolder(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New folder
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
