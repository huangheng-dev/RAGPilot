export function resolveDisplayLocale() {
  if (typeof document !== "undefined") {
    return document.documentElement.lang || "en";
  }

  return "en";
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(resolveDisplayLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateTimeWithYear(value: string) {
  return new Intl.DateTimeFormat(resolveDisplayLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatStatusLabel(value: string) {
  if (resolveDisplayLocale().startsWith("zh")) {
    const zhStatusLabels: Record<string, string> = {
      active: "活跃",
      archived: "已归档",
      cancelled: "已取消",
      completed: "已完成",
      created: "已创建",
      draft: "草稿",
      failed: "失败",
      pending: "待处理",
      published: "已发布",
      queued: "排队中",
      running: "运行中"
    };

    if (zhStatusLabels[value]) {
      return zhStatusLabels[value];
    }
  }

  return value.replace(/_/g, " ");
}

export function formatWorkflowTypeLabel(value: string | null) {
  if (!value) {
    return resolveDisplayLocale().startsWith("zh") ? "工作流" : "workflow";
  }

  if (resolveDisplayLocale().startsWith("zh")) {
    const zhWorkflowTypeLabels: Record<string, string> = {
      document_ingestion: "文档接入"
    };

    if (zhWorkflowTypeLabels[value]) {
      return zhWorkflowTypeLabels[value];
    }
  }

  return value.replace(/_/g, " ");
}

export function formatParserLabel(value: string | null) {
  if (!value) {
    return resolveDisplayLocale().startsWith("zh") ? "解析器待定" : "parser pending";
  }

  if (resolveDisplayLocale().startsWith("zh")) {
    const zhParserLabels: Record<string, string> = {
      plain_text_parser: "纯文本解析器"
    };

    if (zhParserLabels[value]) {
      return zhParserLabels[value];
    }
  }

  return value.replace(/_/g, " ");
}

export function formatSubjectTypeLabel(value: string | null) {
  if (!value) {
    return resolveDisplayLocale().startsWith("zh") ? "未绑定" : "unbound";
  }

  if (resolveDisplayLocale().startsWith("zh")) {
    const zhSubjectTypeLabels: Record<string, string> = {
      document: "文档"
    };

    if (zhSubjectTypeLabels[value]) {
      return zhSubjectTypeLabels[value];
    }
  }

  return value.replace(/_/g, " ");
}

export function formatWorkflowStepLabel(value: string) {
  if (resolveDisplayLocale().startsWith("zh")) {
    const zhWorkflowStepLabels: Record<string, string> = {
      ingest_document: "接入文档"
    };

    if (zhWorkflowStepLabels[value]) {
      return zhWorkflowStepLabels[value];
    }
  }

  return value.replace(/_/g, " ");
}

export function formatFileSize(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat(resolveDisplayLocale()).format(value);
}

export function formatDurationRange(startValue: string | null, endValue: string | null) {
  if (!startValue || !endValue) {
    return "n/a";
  }

  const durationMs = new Date(endValue).getTime() - new Date(startValue).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "n/a";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

export function getStatusBadgeClass(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "cancelled") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (status === "running" || status === "queued") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function compareStringValues(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function slugifyValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
