"use client";

import { useRouter, usePathname } from "next/navigation";
import { DOC_SECTIONS } from "./DocsSidebar";

export default function DocsMobileNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="lg:hidden mb-6">
      <label className="sr-only">Doc section</label>
      <select
        value={pathname}
        onChange={(e) => router.push(e.target.value)}
        className="w-full bg-bg-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text focus:border-accent outline-none"
      >
        {DOC_SECTIONS.map((s) => (
          <option key={s.href} value={s.href}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
