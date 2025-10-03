import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Pin, Trash2, Folder, Pencil } from "lucide-react";

interface ChatContextMenuProps {
  chatId: string;
  isPinned: boolean;
  onPin: () => void;
  onArchive: () => void;
  onMoveToFolder: () => void;
  onRename: () => void;
  children: React.ReactNode;
}

export const ChatContextMenu = ({
  chatId,
  isPinned,
  onPin,
  onArchive,
  onMoveToFolder,
  onRename,
  children,
}: ChatContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onRename}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onPin}>
          <Pin className="w-4 h-4 mr-2" />
          {isPinned ? "Unpin" : "Pin to sidebar"}
        </ContextMenuItem>
        <ContextMenuItem onClick={onMoveToFolder}>
          <Folder className="w-4 h-4 mr-2" />
          Move to folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onArchive} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
