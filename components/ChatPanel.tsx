"use client";

import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  ConversationHeader,
  Avatar,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import { HiOutlineX } from "react-icons/hi";

export type ChatMessage = { role: "user" | "ai"; text: string; sentTime?: string; sender?: string };

export default function ChatPanel({
  open,
  onClose,
  messages,
  onSend,
  title = "Study Assistant",
  typing = false,
  botName = "Knotes AI",
  botAvatarUrl = "https://chatscope.io/storybook/react/assets/zoe-E7ZdmXF0.svg",
  userName = "You",
  userAvatarUrl = "",
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  title?: string;
  typing?: boolean;
  botName?: string;
  botAvatarUrl?: string;
  userName?: string;
  userAvatarUrl?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed top-24 bottom-28 right-4 z-50 w-[88vw] max-w-md rounded-2xl bg-white/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-2xl overflow-hidden">
      {/* Header using Chatscope ConversationHeader for consistency */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2 text-slate-900 dark:text-[--color-accent]">
          <span className="font-semibold">{title}</span>
        </div>
        <button
          aria-label="Close chat"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/10 hover:bg-white/90"
          onClick={onClose}
        >
          <HiOutlineX size={16} />
        </button>
      </div>

      <div style={{ position: "relative", height: "calc(100% - 49px)" }} className="bg-transparent">
        <MainContainer>
          <ChatContainer>
            {/* Optional built-in header commented out to avoid double header */}
            <MessageList scrollBehavior="smooth" typingIndicator={typing ? <TypingIndicator content={`${botName} is typing…`} /> : undefined}>
              {messages.map((m, idx) => {
                const direction = m.role === "user" ? "outgoing" : "incoming";
                const sender = m.sender || (m.role === "user" ? userName : botName);
                return (
                  <Message
                    key={idx}
                    model={{
                      message: m.text,
                      sentTime: m.sentTime || "",
                      sender,
                      direction,
                    }}
                  >
                    {direction === "incoming" ? (
                      <Avatar name={botName} src={botAvatarUrl} size="sm" />
                    ) : userAvatarUrl ? (
                      <Avatar name={userName} src={userAvatarUrl} size="sm" />
                    ) : null}
                  </Message>
                );
              })}
            </MessageList>
            <MessageInput
              placeholder="Type message here"
              onSend={(val) => {
                const text = (val || "").toString().trim();
                if (text.length > 0) onSend(text);
              }}
              attachButton={false}
            />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
