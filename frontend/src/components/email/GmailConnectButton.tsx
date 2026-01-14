/**
 * Gmail Connect Button - OAuth connection/disconnection
 */

import { Mail, LogOut, RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGmail } from '@/contexts/GmailContext';

export default function GmailConnectButton() {
  const {
    isAuthenticated,
    isLoading,
    user,
    connect,
    disconnect,
    refreshEmails,
  } = useGmail();

  if (isLoading) {
    return (
      <Button disabled variant="outline" size="sm">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button onClick={connect} variant="outline" size="sm">
        <Mail className="w-4 h-4 mr-2" />
        Connect Gmail
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Avatar className="w-5 h-5">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback>
              <User className="w-3 h-3" />
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[150px] truncate hidden sm:inline">
            {user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={refreshEmails}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Emails
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
