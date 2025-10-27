"use client";

import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { getCodeString } from "rehype-rewrite";
import mermaid from "mermaid";

// Render Mermaid blocks inside MarkdownPreview
const randomid = () => parseInt(String(Math.random() * 1e15), 10).toString(36);

function Code({ inline, children = [], className, ...props }: any) {
  const demoid = useRef(`dome${randomid()}`);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const isMermaid = className && /^language-mermaid/.test(String(className).toLowerCase());
  const code = props.node && props.node.children ? getCodeString(props.node.children) : (children?.[0] ?? "");

  const reRender = async () => {
    if (container && isMermaid) {
      try {
        const { svg } = await mermaid.render(demoid.current, code as string);
        container.innerHTML = svg;
      } catch (error: any) {
        container.innerHTML = String(error);
      }
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
  return (
    <MarkdownPreview
      source={source || ""}
      className={className}
      style={{ padding: 0 }}
      components={{ code: Code as any }}
      wrapperElement={{ "data-color-mode": colorMode }}
    />
  );
}
