import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";

export function InboxScreen() {
  return (
    <ResizableSidebarLayout
      panelId="inbox"
      sidebarDefaultSize={22}
      sidebarMinSize={14}
      sidebarMaxSize={34}
      sidebar={
        <div className="flex h-full flex-col border-r bg-muted/10">
          <div className="p-4 text-sm font-medium">Inbox Sidebar</div>
        </div>
      }
      content={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Inbox coming soon
        </div>
      }
    />
  );
}
