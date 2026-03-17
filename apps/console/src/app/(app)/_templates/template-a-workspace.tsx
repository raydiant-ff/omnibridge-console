/**
 * Template A — Workspace Page
 *
 * Layout: sidebar + top bar + page header + 2–3 content panels + optional right rail
 * Use for: dashboards, record overviews, module landing pages
 */

import { PageViewport, PageHeader, PageHeaderMeta, PageActions, Stack } from "@/components/layout";
import { Panel, PanelHeader, PanelMeta, PanelContent } from "@/components/panels";
import { PlaceholderBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { RailLayout } from "@/components/layout";
import { StickyRail } from "@/components/shell";

export default function TemplateAWorkspace() {
  return (
    <PageViewport>
      {/* Page header */}
      <PageHeader>
        <PageHeaderMeta
          title="Workspace Page"
          description="Module landing page with panels and optional right rail"
        />
        <PageActions>
          <Button variant="outline" size="sm">Secondary</Button>
          <Button size="sm">Primary action</Button>
        </PageActions>
      </PageHeader>

      {/* Body: main content + optional right rail */}
      <RailLayout
        rail={
          <StickyRail className="w-72 rounded-xl border border-border bg-card p-4">
            <PlaceholderBlock label="Right rail" height="h-full" />
          </StickyRail>
        }
      >
        <Stack gap="md">
          {/* Panel 1 */}
          <Panel>
            <PanelHeader>
              <PanelMeta title="Panel A" description="Primary content area" />
            </PanelHeader>
            <PanelContent>
              <PlaceholderBlock label="Content A" height="h-40" />
            </PanelContent>
          </Panel>

          {/* Panel 2 */}
          <Panel>
            <PanelHeader>
              <PanelMeta title="Panel B" description="Secondary content area" />
            </PanelHeader>
            <PanelContent>
              <PlaceholderBlock label="Content B" height="h-32" />
            </PanelContent>
          </Panel>

          {/* Panel 3 (optional) */}
          <Panel>
            <PanelHeader>
              <PanelMeta title="Panel C" description="Tertiary content area" />
            </PanelHeader>
            <PanelContent>
              <PlaceholderBlock label="Content C" height="h-32" />
            </PanelContent>
          </Panel>
        </Stack>
      </RailLayout>
    </PageViewport>
  );
}
