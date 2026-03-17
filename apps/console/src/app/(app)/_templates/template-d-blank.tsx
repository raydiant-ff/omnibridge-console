/**
 * Template D — Blank Operational Canvas
 *
 * Shell only. Placeholder sections. Used to test structure and composition
 * before committing to a specific page layout.
 */

import { PageViewport, PageHeader, PageHeaderMeta, PageActions, Stack, SplitLayout } from "@/components/layout";
import { PlaceholderBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { SectionStack, SectionBlock } from "@/components/shell";

export default function TemplateDBlank() {
  return (
    <PageViewport>
      {/* Page header */}
      <PageHeader>
        <PageHeaderMeta
          title="Blank Canvas"
          description="Structural scaffold — replace placeholders with real content"
        />
        <PageActions>
          <Button variant="outline" size="sm">Action</Button>
          <Button size="sm">Primary</Button>
        </PageActions>
      </PageHeader>

      <SectionStack gap="md">
        {/* Full-width section */}
        <SectionBlock>
          <PlaceholderBlock label="Signal strip / top-level summary" height="h-16" />
        </SectionBlock>

        {/* Split: main + sidebar */}
        <SplitLayout split="2/3" gap="md">
          {/* Primary column */}
          <Stack gap="md" className="flex-1 min-w-0">
            <SectionBlock>
              <PlaceholderBlock label="Primary panel A" height="h-48" />
            </SectionBlock>
            <SectionBlock>
              <PlaceholderBlock label="Primary panel B" height="h-40" />
            </SectionBlock>
          </Stack>

          {/* Secondary column */}
          <Stack gap="md" className="w-72 shrink-0">
            <SectionBlock>
              <PlaceholderBlock label="Side panel A" height="h-48" />
            </SectionBlock>
            <SectionBlock>
              <PlaceholderBlock label="Side panel B" height="h-32" />
            </SectionBlock>
          </Stack>
        </SplitLayout>

        {/* Full-width bottom section */}
        <SectionBlock>
          <PlaceholderBlock label="Table / list region" height="h-56" />
        </SectionBlock>
      </SectionStack>
    </PageViewport>
  );
}
