/**
 * Email Sidebar - Label/folder navigation
 */

import { cn } from '@/lib/utils';
import { useGmail } from '@/contexts/GmailContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  AlertCircle,
  Tag,
  PenSquare,
} from 'lucide-react';

interface EmailSidebarProps {
  onCompose: () => void;
}

// Map system labels to icons
const LABEL_ICONS: Record<string, React.ReactNode> = {
  INBOX: <Inbox className="w-4 h-4" />,
  SENT: <Send className="w-4 h-4" />,
  DRAFT: <FileText className="w-4 h-4" />,
  STARRED: <Star className="w-4 h-4" />,
  TRASH: <Trash2 className="w-4 h-4" />,
  SPAM: <AlertCircle className="w-4 h-4" />,
};

// Labels to show in sidebar (in order)
const VISIBLE_LABELS = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH', 'SPAM'];

export default function EmailSidebar({ onCompose }: EmailSidebarProps) {
  const { labels, currentLabel, setCurrentLabel, fetchEmails, isLoadingEmails } = useGmail();

  // Get system labels in order
  const systemLabels = VISIBLE_LABELS
    .map(id => labels.find(l => l.id === id))
    .filter(Boolean);

  // Get user labels
  const userLabels = labels.filter(l => l.type === 'user');

  const handleLabelClick = (labelId: string) => {
    setCurrentLabel(labelId);
    fetchEmails(labelId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compose Button */}
      <div className="p-4">
        <Button onClick={onCompose} className="w-full" size="lg">
          <PenSquare className="w-4 h-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Labels */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {/* System Labels */}
          <div className="space-y-1">
            {systemLabels.map(label => (
              <button
                key={label!.id}
                onClick={() => handleLabelClick(label!.id)}
                disabled={isLoadingEmails}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  'hover:bg-accent',
                  currentLabel === label!.id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground'
                )}
              >
                {LABEL_ICONS[label!.id] || <Tag className="w-4 h-4" />}
                <span className="flex-1 text-left">{label!.name}</span>
                {label!.messagesUnread ? (
                  <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {label!.messagesUnread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* User Labels */}
          {userLabels.length > 0 && (
            <>
              <div className="mt-6 mb-2 px-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Labels
                </span>
              </div>
              <div className="space-y-1">
                {userLabels.map(label => (
                  <button
                    key={label.id}
                    onClick={() => handleLabelClick(label.id)}
                    disabled={isLoadingEmails}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      'hover:bg-accent',
                      currentLabel === label.id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Tag
                      className="w-4 h-4"
                      style={{
                        color: label.color?.backgroundColor,
                      }}
                    />
                    <span className="flex-1 text-left truncate">{label.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
