"use client";

import React from "react";
import { User, Palette, Key, Settings, Users, FolderGit2, Plug } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@multica/ui/components/ui/tabs";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { useCurrentWorkspace } from "@multica/core/paths";
import { PageHeader } from "../../layout/page-header";
import { AccountTab } from "./account-tab";
import { AppearanceTab } from "./appearance-tab";
import { TokensTab } from "./tokens-tab";
import { WorkspaceTab } from "./workspace-tab";
import { MembersTab } from "./members-tab";
import { RepositoriesTab } from "./repositories-tab";
import { IntegrationsTab } from "./integrations-tab";

const accountTabs = [
  { value: "profile", label: "Profile", icon: User },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "tokens", label: "API Tokens", icon: Key },
];

const workspaceTabs = [
  { value: "workspace", label: "General", icon: Settings },
  { value: "repositories", label: "Repositories", icon: FolderGit2 },
  { value: "integrations", label: "Integrations", icon: Plug },
  { value: "members", label: "Members", icon: Users },
];

export interface ExtraSettingsTab {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface SettingsPageProps {
  /** Additional tabs injected by platform (e.g. desktop daemon settings) */
  extraAccountTabs?: ExtraSettingsTab[];
}

/** Phones lay the tab rail out as a horizontal strip, so each trigger has to
 *  keep its width and stay tall enough to hit comfortably. */
const TRIGGER_CLASS = "shrink-0 whitespace-nowrap min-h-9 md:min-h-0";

export function SettingsPage({ extraAccountTabs }: SettingsPageProps = {}) {
  const workspaceName = useCurrentWorkspace()?.name;
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* On desktop the rail carries its own "Settings" heading, but a phone
          needs the sidebar trigger here or there is no way back to navigation. */}
      <PageHeader className="md:hidden">
        <span className="text-sm font-medium">Settings</span>
      </PageHeader>

      <Tabs
        defaultValue="profile"
        orientation={isMobile ? "horizontal" : "vertical"}
        className="flex flex-1 min-h-0 flex-col gap-0 md:flex-row"
      >
      {/* Nav: a scrollable strip on phones, a fixed rail from md up. A 208px
          rail would otherwise take more than half of a 375px screen. */}
      <div className="shrink-0 border-b p-2 md:w-52 md:border-b-0 md:border-r md:overflow-y-auto md:p-4">
        <h1 className="hidden md:block text-sm font-semibold mb-4 px-2">Settings</h1>
        <TabsList
          variant="line"
          // justify-start matters: the base list centres its items, and a
          // centred flex row that overflows pushes its leading items to a
          // negative offset where no amount of scrolling can reach them. On a
          // phone that hid "Profile", the tab that is selected by default.
          className="w-full h-auto flex-row justify-start overflow-x-auto md:w-fit md:h-fit md:flex-col md:items-stretch md:justify-center md:overflow-x-visible"
        >
          {/* My Account group */}
          <span className="hidden md:block px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            My Account
          </span>
          {accountTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER_CLASS}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
          {extraAccountTabs?.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER_CLASS}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}

          {/* Workspace group */}
          <span className="hidden md:block px-2 pb-1 pt-4 text-xs font-medium text-muted-foreground truncate">
            {workspaceName ?? "Workspace"}
          </span>
          {workspaceTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER_CLASS}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Right content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
          <TabsContent value="profile"><AccountTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
          <TabsContent value="tokens"><TokensTab /></TabsContent>
          <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
          <TabsContent value="repositories"><RepositoriesTab /></TabsContent>
          <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
          {extraAccountTabs?.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>{tab.content}</TabsContent>
          ))}
        </div>
      </div>
      </Tabs>
    </div>
  );
}
