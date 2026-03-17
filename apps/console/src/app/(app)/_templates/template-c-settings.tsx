/**
 * Template C — Settings / Config Page
 *
 * Layout: narrow container + form sections + save actions
 * Use for: settings, preferences, configuration, admin views
 */

import { PageViewport, PageHeader, PageHeaderMeta, PageSection, PageSectionHeader, PageSectionBody, Stack } from "@/components/layout";
import { Panel, PanelContent, PanelFooter } from "@/components/panels";
import { PlaceholderBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function TemplateCSettings() {
  return (
    <PageViewport>
      <div className="max-w-2xl">
        {/* Page header */}
        <PageHeader>
          <PageHeaderMeta
            title="Settings"
            description="Manage configuration and preferences"
          />
        </PageHeader>

        <Stack gap="lg">
          {/* Section 1 */}
          <PageSection>
            <PageSectionHeader
              title="General"
              description="Basic configuration options"
            />
            <PageSectionBody>
              <Panel>
                <PanelContent>
                  <PlaceholderBlock label="Form fields — general" height="h-36" />
                </PanelContent>
                <PanelFooter>
                  <span className="text-xs text-muted-foreground">Changes are saved immediately.</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Cancel</Button>
                    <Button size="sm">Save</Button>
                  </div>
                </PanelFooter>
              </Panel>
            </PageSectionBody>
          </PageSection>

          <Separator />

          {/* Section 2 */}
          <PageSection>
            <PageSectionHeader
              title="Integrations"
              description="External system configuration"
            />
            <PageSectionBody>
              <Panel>
                <PanelContent>
                  <PlaceholderBlock label="Form fields — integrations" height="h-36" />
                </PanelContent>
                <PanelFooter>
                  <span />
                  <Button size="sm">Save changes</Button>
                </PanelFooter>
              </Panel>
            </PageSectionBody>
          </PageSection>

          <Separator />

          {/* Section 3 — destructive zone */}
          <PageSection>
            <PageSectionHeader
              title="Danger zone"
              description="Irreversible actions"
            />
            <PageSectionBody>
              <Panel className="border-destructive/30">
                <PanelContent>
                  <PlaceholderBlock label="Destructive actions" height="h-24" />
                </PanelContent>
              </Panel>
            </PageSectionBody>
          </PageSection>
        </Stack>
      </div>
    </PageViewport>
  );
}
