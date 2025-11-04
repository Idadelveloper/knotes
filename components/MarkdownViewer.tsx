"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
    // Prevent Mermaid from auto-starting and from rendering error text into the DOM
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      logLevel: "fatal",
      // Mermaid v10+ option to avoid rendering error labels
      suppressErrorRendering: true,
      // Be permissive; we do our own validation and hide invalid blocks
      strict: false,
    } as any);
    // Suppress any default parse error handler that might inject text
    (mermaid as any).parseError = function () { /* no-op to avoid UI error spam */ };
    // Some builds expose mermaidAPI separately; disable there too just in case
    if ((mermaid as any).mermaidAPI) {
      try { (mermaid as any).mermaidAPI.parseError = function () { /* no-op */ }; } catch {}
      try { (mermaid as any).mermaidAPI.initialize?.({ suppressErrorRendering: true, startOnLoad: false, securityLevel: "loose", strict: false }); } catch {}
    }
    mermaidInitialized = true;
  } catch {
    // ignore
  }
}

// Render Mermaid blocks inside MarkdownPreview
const randomid = () => parseInt(String(Math.random() * 1e15), 10).toString(36);

function isLikelyMermaidDiagram(text: string) {
  const t = String(text || "").trim();
  if (!t) return false;
  // Accept common Mermaid diagram starters
  const starters = [
    "graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "stateDiagram-v2",
    "erDiagram", "journey", "gantt", "pie", "mindmap", "timeline", "quadrantChart", "xyChart",
    "requirementDiagram"
  ];
  return starters.some((s) => t.startsWith(s));
}

function Code({ inline, children = [], className, ...props }: any) {
  const demoid = useRef(`dome${randomid()}`);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const isMermaid = className && /^language-mermaid/.test(String(className).toLowerCase());
  const code = props.node && props.node.children ? getCodeString(props.node.children) : (children?.[0] ?? "");

  const reRender = async () => {
    try {
      if (!container || !isMermaid) return;
      ensureMermaidInit();

      const valid = isLikelyMermaidDiagram(String(code || ""));
      if (!valid) {
        // Hide container entirely to avoid any gaps when content is invalid
        container.style.display = "none";
        container.innerHTML = "";
        return;
      }

      try {
        const { svg } = await mermaid.render(demoid.current, String(code || ""));
        // If Mermaid returned an SVG that contains its own error text, suppress it
        const problematic = typeof svg === 'string' && /Syntax error in text|mermaid version\s+\d/i.test(svg);
        if (problematic) {
          throw new Error('Mermaid returned error SVG');
        }
        container.innerHTML = svg;
        // Ensure container is visible on success
        container.style.removeProperty("display");
      } catch (error: any) {
        try { console.warn('[Mermaid] Render failed:', error); } catch {}
        // Hide container and clear content to avoid visible error text and layout gaps
        container.innerHTML = "";
        container.style.display = "none";
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
    // Use a div container to avoid code/pre styling gaps
    return <div ref={refElement as any} data-name="mermaid" />;
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
