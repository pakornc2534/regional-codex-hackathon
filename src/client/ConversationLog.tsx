import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { thTime } from "../shared/model";
export function ConversationLog({
  messages,
}: {
  messages: {
    at: string;
    role: "owner" | "manager" | "customer";
    text: string;
  }[];
}) {
  if (!messages.length) return null;
  return (
    <MessageScrollerProvider>
      <MessageScroller className="conversation-log" aria-label="ประวัติข้อความ">
        <MessageScrollerViewport>
          <MessageScrollerContent>
            {messages.map((m, i) => (
              <MessageScrollerItem key={i}>
                <Message align={m.role === "owner" ? "end" : "start"}>
                  <MessageContent>
                    <MessageHeader>
                      {m.role === "owner"
                        ? "เจ้าของร้าน"
                        : m.role === "customer"
                          ? "ลูกค้า"
                          : "ผู้จัดการ AI"}{" "}
                      · {thTime(m.at)}
                    </MessageHeader>
                    <Bubble>
                      <BubbleContent>{m.text}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
