/**
 * Email Page - Gmail client interface
 */

import { useState, useEffect } from 'react';
import { useGmail } from '@/contexts/GmailContext';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import EmailSidebar from '@/components/email/EmailSidebar';
import EmailList from '@/components/email/EmailList';
import EmailView from '@/components/email/EmailView';
import EmailCompose from '@/components/email/EmailCompose';
import GmailConnectButton from '@/components/email/GmailConnectButton';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw } from 'lucide-react';
import type { ComposeEmailData } from '@/types/gmail';

export default function Email() {
  const {
    isAuthenticated,
    isLoading,
    connect,
    fetchEmails,
    fetchEmail,
    clearCurrentEmail,
  } = useGmail();

  const [selectedEmailId, setSelectedEmailId] = useState<string | undefined>();
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState<Partial<ComposeEmailData>>({});

  // Fetch emails when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails();
    }
  }, [isAuthenticated, fetchEmails]);

  const handleEmailClick = (emailId: string) => {
    setSelectedEmailId(emailId);
    fetchEmail(emailId);
  };

  const handleBack = () => {
    setSelectedEmailId(undefined);
    clearCurrentEmail();
  };

  const handleCompose = () => {
    setComposeData({});
    setShowCompose(true);
  };

  const handleReply = (data: Partial<ComposeEmailData>) => {
    setComposeData(data);
    setShowCompose(true);
  };

  const handleForward = (data: Partial<ComposeEmailData>) => {
    setComposeData(data);
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setComposeData({});
  };

  // Not authenticated view
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Connect Your Gmail</h1>
          <p className="text-muted-foreground">
            Connect your Gmail account to read, write, and send emails directly from ScholarGraph.
          </p>
          <Button onClick={connect} size="lg">
            <Mail className="w-4 h-4 mr-2" />
            Connect Gmail Account
          </Button>
        </div>
      </div>
    );
  }

  // Loading view
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Main email client view
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Email</h1>
        <GmailConnectButton />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <EmailSidebar onCompose={handleCompose} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Email list */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <EmailList
              onEmailClick={handleEmailClick}
              selectedEmailId={selectedEmailId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Email view */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <EmailView
              onBack={handleBack}
              onReply={handleReply}
              onForward={handleForward}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Compose dialog */}
      <EmailCompose
        open={showCompose}
        onClose={handleCloseCompose}
        initialData={composeData}
      />
    </div>
  );
}
