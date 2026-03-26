import { getSupportWorkspaceData } from "./queries";
import { SupportWorkspace } from "./support-workspace";

export default async function SupportPage() {
  const conversations = await getSupportWorkspaceData();
  return <SupportWorkspace initialConversations={conversations} />;
}
