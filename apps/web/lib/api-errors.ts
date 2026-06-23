type ApiErrorDetailItem = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

type ApiErrorEnvelope = {
  detail?: string | ApiErrorDetailItem[];
  message?: string;
  error?: string;
};

const MESSAGE_CITATION_REWRITE_CONFLICT_PATTERNS = [
  "fk_message_citations_document_chunk_id_document_chunks",
  "chunks from this processing version are already referenced by grounded chat citations",
  "document version cannot be rewritten in place because its chunks are already referenced by message citations",
];

function formatValidationDetail(detailItems: ApiErrorDetailItem[]) {
  return detailItems
    .map((detailItem) => {
      const location = Array.isArray(detailItem.loc) ? detailItem.loc.join(" > ") : null;
      if (location && detailItem.msg) {
        return `${location}: ${detailItem.msg}`;
      }
      return detailItem.msg ?? detailItem.type ?? null;
    })
    .filter((message): message is string => Boolean(message))
    .join("; ");
}

export function parseApiErrorText(errorText: string, fallbackMessage: string): string {
  const normalizedText = errorText.trim();
  if (!normalizedText) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(normalizedText) as ApiErrorEnvelope;

    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }

    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      return formatValidationDetail(payload.detail);
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    return formatOperatorErrorMessage(normalizedText) ?? fallbackMessage;
  }

  return formatOperatorErrorMessage(normalizedText) ?? fallbackMessage;
}

export async function readApiErrorMessage(response: Response, fallbackMessage?: string): Promise<string> {
  const defaultMessage = fallbackMessage ?? `Request failed with status ${response.status}`;
  const errorText = await response.text();
  return parseApiErrorText(errorText, defaultMessage);
}

export function formatOperatorErrorMessage(errorMessage: string | null | undefined) {
  const normalizedMessage = errorMessage?.trim();
  if (!normalizedMessage) {
    return null;
  }

  const loweredMessage = normalizedMessage.toLowerCase();
  if (
    MESSAGE_CITATION_REWRITE_CONFLICT_PATTERNS.some((pattern) => loweredMessage.includes(pattern)) ||
    (loweredMessage.includes("foreignkeyviolation") &&
      loweredMessage.includes("message_citations") &&
      loweredMessage.includes("document_chunks"))
  ) {
    return "This document version is already cited in grounded chat history. Queue a fresh reindex run and review the failed workflow instead of rewriting the cited version in place.";
  }

  return normalizedMessage;
}
