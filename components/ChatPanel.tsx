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
import { FaMicrophone, FaVolumeUp } from "react-icons/fa";

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
  onMicStart,
  onMicStop,
  recording = false,
  speakEnabled = false,
  onToggleSpeak,
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
  onMicStart?: () => void;
  onMicStop?: () => void;
  recording?: boolean;
  speakEnabled?: boolean;
  onToggleSpeak?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed top-16 bottom-6 right-4 z-50 w-[92vw] max-w-lg rounded-2xl bg-white/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-2xl overflow-hidden flex flex-col">
      {/* Header using Chatscope ConversationHeader for consistency */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2 text-slate-900 dark:text-[--color-accent]">
          <span className="font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Close chat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/10 hover:bg-white/90"
            onClick={onClose}
          >
            <HiOutlineX size={16} />
          </button>
        </div>
      </div>

      <div className="bg-transparent flex-1 min-h-0">
        <MainContainer style={{ height: "100%" }}>
          <ChatContainer style={{ height: "100%" }} className="flex flex-col h-full">
            {/* Optional built-in header commented out to avoid double header */}
            <MessageList className="flex-1 min-h-0" scrollBehavior="smooth" typingIndicator={typing ? <TypingIndicator content={`${botName} is typing…`} /> : undefined}>
              {messages.map((m, idx) => {
                const direction = m.role === "user" ? "outgoing" : "incoming";
                const sender = m.sender || (m.role === "user" ? userName : botName);
                return (
                  <Message
                    key={idx}
                    model={{
                      // Ensure correct rendering type per role
                      type: m.role === "ai" ? "html" : "text",
                      payload: m.text,
                      sentTime: m.sentTime || "",
                      sender,
                      direction,
                      position: "single",
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
            <div as={MessageInput} className="flex items-center gap-2 px-2 py-2 border-t border-black/10 dark:border-white/10 bg-white/90 dark:bg-[--color-dark-bg]/90 shrink-0">
              {/* Record and Speaker controls moved next to input */}
              <button
                type="button"
                aria-label={recording ? "Stop recording" : "Start recording"}
                title={recording ? "Stop recording" : "Hold to speak or click to toggle recording"}
                className={`inline-flex items-center justify-center h-10 w-10 rounded-md ring-1 ring-black/10 dark:ring-white/10 transition-colors ${recording ? 'bg-red-600 text-white' : 'bg-white/70 dark:bg-white/10 text-slate-800 dark:text-[--color-accent]'}`}
                onMouseDown={onMicStart}
                onMouseUp={onMicStop}
                onTouchStart={onMicStart}
                onTouchEnd={onMicStop}
                onClick={() => { if (recording) onMicStop?.(); else onMicStart?.(); }}
              >
                <FaMicrophone />
              </button>
              <button
                type="button"
                aria-label={speakEnabled ? "Disable voice reply" : "Enable voice reply"}
                title="Toggle voice reply"
                className={`inline-flex items-center justify-center h-10 w-10 rounded-md ring-1 ring-black/10 dark:ring-white/10 transition-colors ${speakEnabled ? 'bg-primary text-slate-900' : 'bg-white/70 dark:bg-white/10 text-slate-800 dark:text-[--color-accent]'}`}
                onClick={onToggleSpeak}
              >
                <FaVolumeUp />
              </button>
              <div className="flex-1">
                <MessageInput
                  placeholder="Type message here"
                  onSend={(val) => {
                    const text = (val || "").toString().trim();
                    if (text.length > 0) onSend(text);
                  }}
                  attachButton={false}
                />
              </div>
            </div>
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
