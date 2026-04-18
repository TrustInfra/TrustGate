import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMobileNav from "@/components/docs/DocsMobileNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-12">
      <DocsSidebar />
      <main className="flex-1 min-w-0 py-10">
        <DocsMobileNav />
        {children}
      </main>
    </div>
  );
}
