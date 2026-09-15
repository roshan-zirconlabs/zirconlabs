type RunnableBot = { status: string; keeperhubWorkflowId: string | null };

export function workflowRunGuard(bot: RunnableBot) {
  if (bot.status !== "ACTIVE" || !bot.keeperhubWorkflowId || bot.keeperhubWorkflowId.startsWith("local_")) {
    return {
      ok: false as const,
      error: "This bot is not published or active. Open the editor, save the workflow, then choose Publish & activate.",
    };
  }
  return { ok: true as const };
}
