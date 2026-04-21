-- CreateEnum
CREATE TYPE "SupportExternalSystem" AS ENUM ('avochato', 'gmail');

-- CreateEnum
CREATE TYPE "SupportChannel" AS ENUM ('sms', 'chat', 'email');

-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('open', 'pending_customer', 'pending_internal', 'resolved', 'closed', 'spam');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "SupportWaitingOn" AS ENUM ('customer', 'internal', 'none');

-- CreateEnum
CREATE TYPE "SupportMessageDirection" AS ENUM ('inbound', 'outbound', 'system');

-- CreateEnum
CREATE TYPE "SupportMessageType" AS ENUM ('text', 'email', 'chat', 'note', 'event');

-- CreateEnum
CREATE TYPE "SupportParticipantRole" AS ENUM ('customer', 'agent', 'cc', 'system');

-- CreateEnum
CREATE TYPE "SupportConversationEventType" AS ENUM ('assigned', 'status_changed', 'priority_changed', 'tagged', 'linked_customer', 'sync_error', 'sync_recovered');

-- CreateTable
CREATE TABLE "support_channel_accounts" (
    "id" TEXT NOT NULL,
    "external_system" "SupportExternalSystem" NOT NULL DEFAULT 'avochato',
    "external_account_id" TEXT,
    "external_subdomain" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_channel_endpoints" (
    "id" TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "external_system" "SupportExternalSystem" NOT NULL DEFAULT 'avochato',
    "external_endpoint_id" TEXT,
    "channel" "SupportChannel" NOT NULL,
    "label" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_channel_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agent_channel_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "channel_endpoint_id" TEXT,
    "external_user_id" TEXT,
    "external_role" TEXT,
    "assigned_only" BOOLEAN NOT NULL DEFAULT false,
    "can_reply" BOOLEAN NOT NULL DEFAULT true,
    "can_assign" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_agent_channel_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" TEXT NOT NULL,
    "external_system" "SupportExternalSystem" NOT NULL DEFAULT 'avochato',
    "external_conversation_id" TEXT NOT NULL,
    "external_account_subdomain" TEXT,
    "channel_account_id" TEXT,
    "channel_endpoint_id" TEXT,
    "customer_index_id" TEXT,
    "sf_account_id" TEXT,
    "stripe_customer_id" TEXT,
    "external_contact_id" TEXT,
    "channel" "SupportChannel" NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportPriority" NOT NULL DEFAULT 'normal',
    "subject" TEXT,
    "assignee_user_id" TEXT,
    "external_assignee_id" TEXT,
    "first_message_at" TIMESTAMP(3) NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "waiting_on" "SupportWaitingOn" DEFAULT 'none',
    "tags_json" JSONB,
    "raw_summary_json" JSONB,
    "payload_json" JSONB,
    "sync_state" TEXT NOT NULL DEFAULT 'active',
    "last_webhook_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "direction" "SupportMessageDirection" NOT NULL,
    "channel" "SupportChannel" NOT NULL,
    "message_type" "SupportMessageType" NOT NULL DEFAULT 'text',
    "body" TEXT,
    "body_html" TEXT,
    "subject" TEXT,
    "from_display" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "delivery_state" TEXT,
    "author_user_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "SupportParticipantRole" NOT NULL,
    "external_contact_id" TEXT,
    "external_user_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sf_contact_id" TEXT,
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_conversation_events" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "external_event_id" TEXT,
    "type" "SupportConversationEventType" NOT NULL,
    "actor_user_id" TEXT,
    "external_actor_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_channel_accounts_external_subdomain_key" ON "support_channel_accounts"("external_subdomain");

-- CreateIndex
CREATE INDEX "support_channel_accounts_external_system_idx" ON "support_channel_accounts"("external_system");

-- CreateIndex
CREATE INDEX "support_channel_endpoints_channel_account_id_idx" ON "support_channel_endpoints"("channel_account_id");

-- CreateIndex
CREATE INDEX "support_channel_endpoints_external_system_channel_idx" ON "support_channel_endpoints"("external_system", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "support_channel_endpoints_channel_account_id_external_endpo_key" ON "support_channel_endpoints"("channel_account_id", "external_endpoint_id");

-- CreateIndex
CREATE INDEX "support_agent_channel_access_channel_account_id_idx" ON "support_agent_channel_access"("channel_account_id");

-- CreateIndex
CREATE INDEX "support_agent_channel_access_channel_endpoint_id_idx" ON "support_agent_channel_access"("channel_endpoint_id");

-- CreateIndex
CREATE INDEX "support_agent_channel_access_external_user_id_idx" ON "support_agent_channel_access"("external_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_agent_channel_access_user_id_channel_account_id_cha_key" ON "support_agent_channel_access"("user_id", "channel_account_id", "channel_endpoint_id");

-- CreateIndex
CREATE INDEX "support_conversations_channel_account_id_idx" ON "support_conversations"("channel_account_id");

-- CreateIndex
CREATE INDEX "support_conversations_channel_endpoint_id_idx" ON "support_conversations"("channel_endpoint_id");

-- CreateIndex
CREATE INDEX "support_conversations_customer_index_id_idx" ON "support_conversations"("customer_index_id");

-- CreateIndex
CREATE INDEX "support_conversations_sf_account_id_idx" ON "support_conversations"("sf_account_id");

-- CreateIndex
CREATE INDEX "support_conversations_stripe_customer_id_idx" ON "support_conversations"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "support_conversations_assignee_user_id_idx" ON "support_conversations"("assignee_user_id");

-- CreateIndex
CREATE INDEX "support_conversations_channel_status_idx" ON "support_conversations"("channel", "status");

-- CreateIndex
CREATE INDEX "support_conversations_priority_last_message_at_idx" ON "support_conversations"("priority", "last_message_at");

-- CreateIndex
CREATE INDEX "support_conversations_last_message_at_idx" ON "support_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_external_system_external_conversation_key" ON "support_conversations"("external_system", "external_conversation_id");

-- CreateIndex
CREATE INDEX "support_messages_sent_at_idx" ON "support_messages"("sent_at");

-- CreateIndex
CREATE INDEX "support_messages_author_user_id_idx" ON "support_messages"("author_user_id");

-- CreateIndex
CREATE INDEX "support_messages_direction_channel_idx" ON "support_messages"("direction", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_conversation_id_external_message_id_key" ON "support_messages"("conversation_id", "external_message_id");

-- CreateIndex
CREATE INDEX "support_participants_conversation_id_idx" ON "support_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "support_participants_external_contact_id_idx" ON "support_participants"("external_contact_id");

-- CreateIndex
CREATE INDEX "support_participants_external_user_id_idx" ON "support_participants"("external_user_id");

-- CreateIndex
CREATE INDEX "support_participants_email_idx" ON "support_participants"("email");

-- CreateIndex
CREATE INDEX "support_participants_phone_idx" ON "support_participants"("phone");

-- CreateIndex
CREATE INDEX "support_conversation_events_conversation_id_created_at_idx" ON "support_conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "support_conversation_events_external_event_id_idx" ON "support_conversation_events"("external_event_id");

-- CreateIndex
CREATE INDEX "support_conversation_events_actor_user_id_idx" ON "support_conversation_events"("actor_user_id");

-- AddForeignKey
ALTER TABLE "support_channel_endpoints" ADD CONSTRAINT "support_channel_endpoints_channel_account_id_fkey" FOREIGN KEY ("channel_account_id") REFERENCES "support_channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agent_channel_access" ADD CONSTRAINT "support_agent_channel_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agent_channel_access" ADD CONSTRAINT "support_agent_channel_access_channel_account_id_fkey" FOREIGN KEY ("channel_account_id") REFERENCES "support_channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_agent_channel_access" ADD CONSTRAINT "support_agent_channel_access_channel_endpoint_id_fkey" FOREIGN KEY ("channel_endpoint_id") REFERENCES "support_channel_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_channel_account_id_fkey" FOREIGN KEY ("channel_account_id") REFERENCES "support_channel_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_channel_endpoint_id_fkey" FOREIGN KEY ("channel_endpoint_id") REFERENCES "support_channel_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_customer_index_id_fkey" FOREIGN KEY ("customer_index_id") REFERENCES "customer_index"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_participants" ADD CONSTRAINT "support_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversation_events" ADD CONSTRAINT "support_conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversation_events" ADD CONSTRAINT "support_conversation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

