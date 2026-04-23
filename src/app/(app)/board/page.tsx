import { redirect } from "next/navigation";

import { BoardWorkspace } from "@/components/board/board-workspace";
import { getBoardWorkspaceData } from "@/lib/board/server";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function BoardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/board");
  }

  const workspace = await getBoardWorkspaceData(user.id);

  return (
    <BoardWorkspace
      userId={user.id}
      userEmail={user.email ?? "unknown@user"}
      initialBoard={workspace.activeBoard}
      initialBoards={workspace.boards}
    />
  );
}
