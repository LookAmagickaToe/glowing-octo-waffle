/**
 * Email View - displays a single email
 */

import { useGmail } from '@/contexts/GmailContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Reply,
  Forward,
  Star,
  Archive,
  Trash2,
  MailOpen,
  Mail,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { parseEmailAddress } from '@/services/gmailService';
import type { ComposeEmailData } from '@/types/gmail';

interface EmailViewProps {
  onBack: () => void;
  onReply: (data: Partial<ComposeEmailData>) => void;
  onForward: (data: Partial<ComposeEmailData>) => void;
}

export default function EmailView({ onBack, onReply, onForward }: EmailViewProps) {
  const {
    currentEmail,
    isLoadingEmail,
    starMessage,
    unstarMessage,
    archiveMessage,
    trashMessage,
    markAsRead,
    markAsUnread,
  } = useGmail();

  if (isLoadingEmail) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentEmail) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select an email to read</p>
      </div>
    );
  }

  const { name: senderName, email: senderEmail } = parseEmailAddress(currentEmail.from);
  const initials = senderName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleStar = async () => {
    if (currentEmail.isStarred) {
      await unstarMessage(currentEmail.id);
    } else {
      await starMessage(currentEmail.id);
    }
  };

  const handleArchive = async () => {
    await archiveMessage(currentEmail.id);
    onBack();
  };

  const handleTrash = async () => {
    await trashMessage(currentEmail.id);
    onBack();
  };

  const handleToggleRead = async () => {
    if (currentEmail.isRead) {
      await markAsUnread(currentEmail.id);
    } else {
      await markAsRead(currentEmail.id);
    }
  };

  const handleReply = () => {
    onReply({
      to: currentEmail.from,
      subject: currentEmail.subject.startsWith('Re:')
        ? currentEmail.subject
        : `Re: ${currentEmail.subject}`,
      threadId: currentEmail.threadId,
    });
  };

  const handleForward = () => {
    onForward({
      subject: currentEmail.subject.startsWith('Fwd:')
        ? currentEmail.subject
        : `Fwd: ${currentEmail.subject}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${currentEmail.from}\nDate: ${currentEmail.date.toLocaleString()}\nSubject: ${currentEmail.subject}\nTo: ${currentEmail.to}\n\n${currentEmail.body}`,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleReply} title="Reply">
            <Reply className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleForward} title="Forward">
            <Forward className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleStar} title="Star">
            <Star
              className="w-4 h-4"
              fill={currentEmail.isStarred ? 'currentColor' : 'none'}
              color={currentEmail.isStarred ? '#eab308' : 'currentColor'}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleArchive} title="Archive">
            <Archive className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleTrash} title="Delete">
            <Trash2 className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleRead}>
                {currentEmail.isRead ? (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Mark as unread
                  </>
                ) : (
                  <>
                    <MailOpen className="w-4 h-4 mr-2" />
                    Mark as read
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Email content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Subject */}
          <h1 className="text-xl font-semibold mb-4">
            {currentEmail.subject || '(no subject)'}
          </h1>

          {/* Sender info */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="w-10 h-10">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{senderName}</span>
                  <span className="text-muted-foreground ml-2 text-sm">
                    &lt;{senderEmail}&gt;
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentEmail.date.toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                To: {currentEmail.to}
                {currentEmail.cc && <span>, Cc: {currentEmail.cc}</span>}
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Body */}
          {currentEmail.htmlBody ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: currentEmail.htmlBody }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm">{currentEmail.body}</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
