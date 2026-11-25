import { requireStaffPage } from "@/lib/auth/guard";
import { isWebLookupEnabled, readWebEnv } from "@/lib/chatbot/web-knowledge";
import { prisma } from "@/lib/prisma";
import KnowledgeClient, { type KnowledgeRow } from "./KnowledgeClient";

export default async function KnowledgePage() {
  const user = await requireStaffPage();
  const sources = await prisma.knowledgeSource.findMany({
    orderBy: [{ isActive: "desc" }, { syncedAt: "desc" }],
    take: 200,
  });
  const rows: KnowledgeRow[] = sources.map((s) => ({
    id: s.id,
    title: s.title,
    sourceUrl: s.sourceUrl,
    summary: s.summary,
    category: s.category,
    isActive: s.isActive,
    syncedAt: s.syncedAt.toISOString(),
  }));
  return (
    <KnowledgeClient
      rows={rows}
      isAdmin={user.role === "ADMIN"}
      searchEnabled={isWebLookupEnabled()}
      allowedDomains={readWebEnv().allowedDomains}
    />
  );
}
