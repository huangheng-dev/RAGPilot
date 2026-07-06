import type { AgentRunRecordInput } from "@/lib/agent-runs";

export type ConsoleFollowUpAction<THref> = {
  label: string;
  href: THref;
  runRecord?: AgentRunRecordInput | null;
};

function buildActionToken<THref>(action: ConsoleFollowUpAction<THref>) {
  return `${action.label}:${JSON.stringify(action.href)}`;
}

export function buildUniqueConsoleFollowUpActions<THref>(
  primaryActionHref: THref,
  actions: ConsoleFollowUpAction<THref>[]
) {
  const primaryToken = JSON.stringify(primaryActionHref);
  const seen = new Set<string>();

  return actions.filter((action) => {
    if (JSON.stringify(action.href) === primaryToken) {
      return false;
    }

    const token = buildActionToken(action);
    if (seen.has(token)) {
      return false;
    }

    seen.add(token);
    return true;
  });
}

export function withUniqueConsoleFollowUpActions<
  THref,
  TItem extends {
    primaryActionHref: THref;
    secondaryActions: ConsoleFollowUpAction<THref>[];
  }
>(item: TItem): TItem {
  return {
    ...item,
    secondaryActions: buildUniqueConsoleFollowUpActions(item.primaryActionHref, item.secondaryActions)
  };
}
