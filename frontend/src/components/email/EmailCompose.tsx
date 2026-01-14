/**
 * Email Compose - compose new email or reply/forward
 */

import { useState } from 'react';
import { useGmail } from '@/contexts/GmailContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComposeEmailData } from '@/types/gmail';

interface EmailComposeProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<ComposeEmailData>;
}

export default function EmailCompose({ open, onClose, initialData }: EmailComposeProps) {
  const { sendEmail, isSending, user } = useGmail();
  const [showCcBcc, setShowCcBcc] = useState(false);

  const [formData, setFormData] = useState<ComposeEmailData>({
    to: initialData?.to || '',
    cc: initialData?.cc || '',
    bcc: initialData?.bcc || '',
    subject: initialData?.subject || '',
    body: initialData?.body || '',
    threadId: initialData?.threadId,
  });

  const handleChange = (field: keyof ComposeEmailData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.to.trim()) {
      return;
    }

    try {
      await sendEmail(formData);
      onClose();
      // Reset form
      setFormData({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
      });
    } catch {
      // Error is handled by context
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {initialData?.threadId ? 'Reply' : 'New Message'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4">
          {/* From (read-only) */}
          <div className="space-y-2">
            <Label>From</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>

          {/* To */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to">To</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
              >
                {showCcBcc ? (
                  <ChevronUp className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-1" />
                )}
                Cc/Bcc
              </Button>
            </div>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={formData.to}
              onChange={e => handleChange('to', e.target.value)}
              required
            />
          </div>

          {/* Cc & Bcc */}
          {showCcBcc && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cc">Cc</Label>
                <Input
                  id="cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={formData.cc}
                  onChange={e => handleChange('cc', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc">Bcc</Label>
                <Input
                  id="bcc"
                  type="email"
                  placeholder="bcc@example.com"
                  value={formData.bcc}
                  onChange={e => handleChange('bcc', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Subject"
              value={formData.subject}
              onChange={e => handleChange('subject', e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-2 flex-1">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Write your message..."
              value={formData.body}
              onChange={e => handleChange('body', e.target.value)}
              className="min-h-[200px] resize-none flex-1"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSending}>
              <X className="w-4 h-4 mr-2" />
              Discard
            </Button>
            <Button type="submit" disabled={isSending || !formData.to.trim()}>
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
