"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createAgentRun,
  serializeAgentRunNavigationHref,
  type AgentRunNavigationHref,
  type AgentRunRecordInput
} from "@/lib/agent-runs";

type ButtonProps = ComponentProps<typeof Button>;

type AgentRunButtonLinkProps = {
  children: ReactNode;
  href: AgentRunNavigationHref;
  runRecord?: AgentRunRecordInput | null;
} & Omit<ButtonProps, "asChild" | "children">;

export function AgentRunButtonLink({
  children,
  className,
  disabled,
  href,
  runRecord,
  size,
  type = "button",
  variant
}: AgentRunButtonLinkProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const linkHref = serializeAgentRunNavigationHref(href);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!runRecord || disabled || isSubmitting) {
      return;
    }

    event.preventDefault();
    setIsSubmitting(true);

    try {
      await createAgentRun({
        ...runRecord,
        navigation_href: linkHref
      });
    } catch {
      // Let navigation continue even if telemetry persistence fails.
    } finally {
      window.location.assign(linkHref);
      setIsSubmitting(false);
    }
  }

  if (!runRecord) {
    return (
      <Button asChild className={className} disabled={disabled} size={size} type={type} variant={variant}>
        <a href={linkHref}>{children}</a>
      </Button>
    );
  }

  return (
    <Button asChild className={className} disabled={disabled || isSubmitting} size={size} type={type} variant={variant}>
      <a href={linkHref} onClick={(event) => void handleClick(event)}>
        {children}
      </a>
    </Button>
  );
}
