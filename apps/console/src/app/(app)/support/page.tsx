import { getSupportWorkspaceData } from "./queries";
import { SupportWorkspace } from "./support-workspace";
import { getSupportConversationDetail } from "@/lib/support/detail";

export default async function SupportPage() {
  const conversations = await getSupportWorkspaceData();
  const initialSelectedConversationId =
    conversations.find((conversation) => conversation.channel === "sms")?.id ??
    conversations[0]?.id;
  const initialDetail = initialSelectedConversationId
    ? await getSupportConversationDetail(initialSelectedConversationId)
    : null;

  return (
    <SupportWorkspace
      initialConversations={conversations}
      initialDetail={initialDetail}
    />
  );
}
