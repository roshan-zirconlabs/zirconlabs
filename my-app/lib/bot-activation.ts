export function activationAction(status: string, workflowId: string | null) {
  if (status === "ACTIVE" && workflowId && !workflowId.startsWith("local_")) {
    return {
      active: false,
      label: "Pause bot",
      description: "Disable the KeeperHub trigger without deleting the workflow.",
    } as const;
  }
  return {
    active: true,
    label: "Publish & activate",
    description: "Save a valid workflow, publish it to KeeperHub, and enable its trigger.",
  } as const;
}
