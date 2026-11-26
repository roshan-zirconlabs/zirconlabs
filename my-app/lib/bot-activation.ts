/** The one activation button on a bot. */
export function activationAction(status: string) {
  if (status === "ACTIVE") {
    return {
      active: false,
      label: "Pause bot",
      description: "Stop scheduled runs and ignore alerts until you turn it back on.",
    } as const;
  }
  return {
    active: true,
    label: "Activate",
    description: "Save a strategy first. The bot then runs on its schedule or on your alerts.",
  } as const;
}
