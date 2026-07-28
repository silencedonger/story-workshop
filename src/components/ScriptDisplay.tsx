"use client";

import { useMemo } from "react";

interface ScriptDisplayProps {
  content: string;
  isStreaming: boolean;
}

export default function ScriptDisplay({ content, isStreaming }: ScriptDisplayProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;
    return parseMarkdown(content);
  }, [content]);

  if (!content) {
    return (
      <div
        className="rounded-lg p-8 text-center"
        style={{ backgroundColor: "#F5F3EF", border: "1px solid #E8E4DE" }}
      >
        <p style={{ color: "#8A8A8A" }}>正在准备剧本内容...</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-6 md:p-10 script-content"
      style={{
        backgroundColor: "#F5F3EF",
        border: "1px solid #E8E4DE",
        minHeight: "400px",
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: renderedContent ?? "" }}
      />
      {isStreaming && (
        <span
          className="inline-block w-0.5 h-5 ml-0.5 align-middle"
          style={{
            backgroundColor: "#B8977E",
            animation: "ink-dot 1s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

function parseMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Paragraphs - wrap lines that aren't already wrapped in tags
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<li")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}
