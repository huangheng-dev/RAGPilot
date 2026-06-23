type Translator = (key: string, values?: Record<string, string>) => string;

type GroundedValidationDraftQuestionOptions = {
  documentTitle?: string | null;
  workflowStatus?: string | null;
  workflowLabel?: string | null;
  workflowId?: string | null;
};

export function buildGroundedValidationDraftQuestion(
  t: Translator,
  options: GroundedValidationDraftQuestionOptions
) {
  const normalizedDocumentTitle = options.documentTitle?.trim() ?? "";
  if (normalizedDocumentTitle.length > 0) {
    return t("workspace.status.recommendationPrompts.documentReady", {
      title: normalizedDocumentTitle
    });
  }

  const workflowLabel = options.workflowLabel?.trim() || options.workflowId?.trim() || "";
  if (!workflowLabel) {
    return "";
  }

  if (options.workflowStatus === "completed") {
    return t("workspace.status.recommendationPrompts.workflowCompleted", {
      label: workflowLabel
    });
  }

  if (
    options.workflowStatus === "queued" ||
    options.workflowStatus === "running" ||
    options.workflowStatus === "pending"
  ) {
    return t("workspace.status.recommendationPrompts.workflowInProgress", {
      label: workflowLabel
    });
  }

  return "";
}
