/**
 * Email List - displays list of emails
 */

import { cn } from '@/lib/utils';
import { useGmail } from '@/contexts/GmailContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
  Paperclip,
  RefreshCw,
  Loader2,
  Mail,
  MailOpen,
} from 'lucide-react';
import { formatEmailDate, parseEmailAddress } from '@/services/gmailService';
import type { EmailListItem } from '@/types/gmail';

interface EmailListProps {
  onEmailClick: (emailId: string) => void;
  selectedEmailId?: string;
}

export default function EmailList({ onEmailClick, selectedEmailId }: EmailListProps) {
  const {
    emails,
    isLoadingEmails,
    nextPageToken,
    loadMoreEmails,
    refreshEmails,
    starMessage,
    unstarMessage,
  } = useGmail();

  const handleStarClick = async (e: React.MouseEvent, email: EmailListItem) => {
    e.stopPropagation();
    if (email.isStarred) {
      await unstarMessage(email.id);
    } else {
      await starMessage(email.id);
    }
  };

  if (isLoadingEmails && emails.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Mail className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No emails found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={refreshEmails}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {emails.map(email => {
          const { name: senderName } = parseEmailAddress(email.from);

          return (
            <div
              key={email.id}
              onClick={() => onEmailClick(email.id)}
              className={cn(
                'px-4 py-3 cursor-pointer transition-colors hover:bg-accent',
                selectedEmailId === email.id && 'bg-accent',
                !email.isRead && 'bg-accent/30'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Star button */}
                <button
                  onClick={e => handleStarClick(e, email)}
                  className={cn(
                    'mt-0.5 flex-shrink-0 transition-colors',
                    email.isStarred
                      ? 'text-yellow-500 hover:text-yellow-600'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Star
                    className="w-4 h-4"
                    fill={email.isStarred ? 'currentColor' : 'none'}
                  />
                </button>

                {/* Email content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!email.isRead ? (
                        <Mail className="w-4 h-4 flex-shrink-0 text-primary" />
                      ) : (
                        <MailOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          'truncate',
                          !email.isRead ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {senderName}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatEmailDate(email.date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'text-sm truncate',
                        !email.isRead ? 'font-medium' : ''
                      )}
                    >
                      {email.subject || '(no subject)'}
                    </span>
                    {email.hasAttachments && (
                      <Paperclip className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {email.snippet}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more button */}
      {nextPageToken && (
        <div className="p-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMoreEmails}
            disabled={isLoadingEmails}
          >
            {isLoadingEmails ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Load More
          </Button>
        </div>
      )}
    </ScrollArea>
  );
}
