"use client";

import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { getCodeString } from "rehype-rewrite";
import mermaid from "mermaid";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Ensure Mermaid is initialized once and that parse errors do not render visible text
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (mermaidInitialized) return;
  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", logLevel: "fatal" } as any);
    // Suppress any default parse error handler that might inject text
    (mermaid as any).parseError = function () { /* no-op to avoid UI error spam */ };
    mermaidInitialized = true;
  } catch {
    // ignore
  }
}

// Render Mermaid blocks inside MarkdownPreview
const randomid = () => parseInt(String(Math.random() * 1e15), 10).toString(36);

function Code({ inline, children = [], className, ...props }: any) {
  const demoid = useRef(`dome${randomid()}`);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const isMermaid = className && /^language-mermaid/.test(String(className).toLowerCase());
  const code = props.node && props.node.children ? getCodeString(props.node.children) : (children?.[0] ?? "");

  const reRender = async () => {
    try {
      if (container && isMermaid) {
        ensureMermaidInit();
        try {
          // Render directly and suppress any errors; avoid calling mermaid.parse to prevent overlay leaks
          const { svg } = await mermaid.render(demoid.current, String(code || ""));
          container.innerHTML = svg;
        } catch (error: any) {
          // Suppress visible Mermaid errors in the UI; log to console instead.
          try { console.warn('[Mermaid] Render failed:', error); } catch {}
          container.innerHTML = ""; // do not surface error text to users
        }
      }
    } catch {
      // ensure no unhandled rejection ever bubbles up
    }
  };

  useEffect(() => {
    reRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, isMermaid, code, demoid.current]);

  const refElement = useCallback((node: HTMLElement | null) => {
    if (node !== null) setContainer(node);
  }, []);

  if (isMermaid) {
    return (
      <Fragment>
        <code id={demoid.current} style={{ display: "none" }} />
        <code ref={refElement as any} data-name="mermaid" />
      </Fragment>
    );
  }
  return <code>{children}</code>;
}

export default function MarkdownViewer({ source, className, colorMode = "light" }: { source: string; className?: string; colorMode?: "light" | "dark"; }) {
  // Initialize mermaid once per viewer mount as extra safety
  useEffect(() => { ensureMermaidInit(); }, []);
  return (
    <MarkdownPreview
      source={source || ""}
      className={className}
      style={{ padding: 0 }}
      components={{ code: Code as any }}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      wrapperElement={{ "data-color-mode": colorMode }}
    />
  );
}
