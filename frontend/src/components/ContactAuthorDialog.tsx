import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ContactAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
}

const ContactAuthorDialog = ({
  open,
  onOpenChange,
  title,
  description,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onSend,
  isLoading = false,
}: ContactAuthorDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Subject</label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Subject line"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Email</label>
          <Textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={isLoading ? "Generating email..." : "Write your message..."}
            className="min-h-[220px]"
            disabled={isLoading}
          />
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button onClick={onSend} disabled={isLoading || !body.trim()}>
          Send (Mock)
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ContactAuthorDialog;
