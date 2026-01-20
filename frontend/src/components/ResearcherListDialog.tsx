import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResearcherList } from "@/types";

interface ResearcherListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: ResearcherList[];
  title: string;
  description?: string;
  onCreateList: (name: string) => string;
  onConfirm: (listId: string | null) => void;
}

const ResearcherListDialog = ({
  open,
  onOpenChange,
  lists,
  title,
  description,
  onCreateList,
  onConfirm,
}: ResearcherListDialogProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setNewListName('');
    }
  }, [open]);

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    const id = onCreateList(trimmed);
    setSelectedId(id);
    setNewListName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Choose a list</label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedId === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedId(null)}
              >
                No list (All researchers)
              </Button>
              {lists.map((list) => (
                <Button
                  key={list.id}
                  type="button"
                  variant={selectedId === list.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedId(list.id)}
                >
                  {list.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Create new list</label>
            <div className="flex gap-2">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name"
              />
              <Button type="button" variant="outline" onClick={handleCreate}>
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (newListName.trim()) {
                const id = onCreateList(newListName.trim());
                onConfirm(id);
                return;
              }
              onConfirm(selectedId);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResearcherListDialog;
