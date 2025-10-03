import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar as SidebarUI, SidebarContent, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { PlusCircle, MessageSquare, Database, Settings, LogOut, Pin, Folder, MoreVertical, Pencil, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChatContextMenu } from "./ChatContextMenu";
import { FolderDialog } from "./FolderDialog";
import { RenameChatDialog } from "./RenameChatDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  selectedChatId: string | null;
  onSelectChat: (id: string | null) => void;
  user: any;
}

export const Sidebar = ({ selectedChatId, onSelectChat, user }: SidebarProps) => {
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [chats, setChats] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [selectedChatForFolder, setSelectedChatForFolder] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [chatToRename, setChatToRename] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadChats();
    loadFolders();

    const chatsChannel = supabase
      .channel('chats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        () => loadChats()
      )
      .subscribe();

    const foldersChannel = supabase
      .channel('folders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_folders',
        },
        () => loadFolders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, []);

  const loadChats = async () => {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error("Failed to load chats");
    } else {
      setChats(data || []);
    }
  };

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from('chat_folders')
      .select('*')
      .order('name');

    if (error) {
      toast.error("Failed to load folders");
    } else {
      setFolders(data || []);
    }
  };

  const togglePin = async (chatId: string, isPinned: boolean) => {
    const { error } = await supabase
      .from('chats')
      .update({ is_pinned: !isPinned })
      .eq('id', chatId);

    if (error) {
      toast.error("Failed to update chat");
    } else {
      toast.success(isPinned ? "Chat unpinned" : "Chat pinned");
      loadChats();
    }
  };

  const archiveChat = async (chatId: string) => {
    const { error } = await supabase
      .from('chats')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) {
      toast.error("Failed to archive chat");
    } else {
      toast.success("Chat archived");
      if (selectedChatId === chatId) {
        onSelectChat(null);
      }
      loadChats();
    }
  };

  const openFolderDialog = (chatId: string) => {
    setSelectedChatForFolder(chatId);
    setFolderDialogOpen(true);
  };

  const openRenameDialog = (chatId: string, currentTitle: string) => {
    setChatToRename({ id: chatId, title: currentTitle });
    setRenameDialogOpen(true);
  };

  const handleRename = async (newTitle: string) => {
    if (!chatToRename) return;

    const { error } = await supabase
      .from('chats')
      .update({ title: newTitle })
      .eq('id', chatToRename.id);

    if (error) {
      toast.error("Failed to rename chat");
    } else {
      toast.success("Chat renamed");
      loadChats();
    }
  };

  const handleNewChat = () => {
    onSelectChat(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <SidebarUI className="border-r border-gray-200 bg-gray-100/50 h-screen">
      <SidebarContent className="flex flex-col h-full">
        <div className="flex-shrink-0 p-4 space-y-4">
          {open && (
            <div className="flex items-center gap-2 mb-4">
              <Palmtree className="w-5 h-5 text-gray-800" />
              <div className="flex items-center gap-1">
                <span className="font-light text-gray-800">Isola AI</span>
                <span className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Secure RAG</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2 bg-black text-white hover:bg-gray-800"
            variant={selectedChatId === null ? "default" : "default"}
          >
            <PlusCircle className="w-4 h-4 text-white" />
            {open && "New Chat"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 pl-4 pr-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 pb-4">
              {/* Pinned Chats */}
              {chats.filter(c => c.is_pinned).length > 0 && (
                <div className="space-y-1">
                  {open && (
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600">
                      <Pin className="w-3 h-3" />
                      Pinned
                    </div>
                  )}
                  {chats.filter(c => c.is_pinned && !c.folder_id).map((chat) => (
                    <div key={chat.id} className="flex items-center w-full group relative">
                      <Button
                        onClick={() => onSelectChat(chat.id)}
                        variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                        className={`justify-start gap-2 h-9 max-w-[224px] ${selectedChatId === chat.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        {open && (
                          <span className="truncate block text-left">{chat.title}</span>
                        )}
                      </Button>
                      {open && (
                        <div className="absolute right-0 top-0 bottom-0 flex items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white z-50">
                              <DropdownMenuItem onClick={() => openRenameDialog(chat.id, chat.title)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => togglePin(chat.id, chat.is_pinned)}>
                                <Pin className="w-4 h-4 mr-2" />
                                Unpin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFolderDialog(chat.id)}>
                                <Folder className="w-4 h-4 mr-2" />
                                Move to folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => archiveChat(chat.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {/* Folders */}
            {folders.map((folder) => {
              const folderChats = chats.filter(c => c.folder_id === folder.id);
              if (folderChats.length === 0) return null;

              return (
                <div key={folder.id} className="space-y-1">
                  {open && (
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600">
                      <Folder className="w-3 h-3" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  )}
                  {folderChats.map((chat) => (
                    <div key={chat.id} className="flex items-center w-full group relative">
                      <Button
                        onClick={() => onSelectChat(chat.id)}
                        variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                        className={`justify-start gap-2 h-9 max-w-[224px] ${selectedChatId === chat.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        {open && (
                          <span className="truncate block text-left">{chat.title}</span>
                        )}
                      </Button>
                      {open && (
                        <div className="absolute right-0 top-0 bottom-0 flex items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white z-50">
                              <DropdownMenuItem onClick={() => openRenameDialog(chat.id, chat.title)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => togglePin(chat.id, chat.is_pinned)}>
                                <Pin className="w-4 h-4 mr-2" />
                                {chat.is_pinned ? "Unpin" : "Pin to sidebar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFolderDialog(chat.id)}>
                                <Folder className="w-4 h-4 mr-2" />
                                Move to folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => archiveChat(chat.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Uncategorized Chats */}
            {chats.filter(c => !c.is_pinned && !c.folder_id).length > 0 && (
              <div className="space-y-1">
                {chats.filter(c => !c.is_pinned && !c.folder_id).map((chat) => (
                  <div key={chat.id} className="flex items-center w-full group relative">
                    <Button
                      onClick={() => onSelectChat(chat.id)}
                      variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                      className={`justify-start gap-2 h-9 max-w-[224px] ${selectedChatId === chat.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      {open && (
                        <span className="truncate block text-left">{chat.title}</span>
                      )}
                    </Button>
                    {open && (
                      <div className="absolute right-0 top-0 bottom-0 flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white z-50">
                            <DropdownMenuItem onClick={() => openRenameDialog(chat.id, chat.title)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePin(chat.id, chat.is_pinned)}>
                              <Pin className="w-4 h-4 mr-2" />
                              Pin to sidebar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openFolderDialog(chat.id)}>
                              <Folder className="w-4 h-4 mr-2" />
                              Move to folder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => archiveChat(chat.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-shrink-0 p-4">
          <FolderDialog
            open={folderDialogOpen}
            onOpenChange={setFolderDialogOpen}
            chatId={selectedChatForFolder || ""}
            onFolderSelected={() => {
              loadChats();
              setFolderDialogOpen(false);
            }}
          />

          <RenameChatDialog
            open={renameDialogOpen}
            onOpenChange={setRenameDialogOpen}
            currentTitle={chatToRename?.title || ""}
            onRename={handleRename}
          />

          <div className="space-y-1 pt-4 border-t border-gray-200">
            <Button
              onClick={() => navigate("/rag")}
              variant="ghost"
              className="w-full justify-start gap-2"
            >
              <Database className="w-4 h-4" />
              {open && "RAG Workspace"}
            </Button>
            <Button
              onClick={() => navigate("/settings")}
              variant="ghost"
              className="w-full justify-start gap-2"
            >
              <Settings className="w-4 h-4" />
              {open && "Settings"}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              {open && "Logout"}
            </Button>
          </div>
        </div>
      </SidebarContent>
    </SidebarUI>
  );
};
