import { ProjectFile } from "@/lib/workspace";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderMarkdown = (value: string) =>
  escapeHtml(value)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");

const wrapHtmlDocument = (body: string, styles = "", scripts = "") => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VoidLAB Preview</title>
    ${styles ? `<style>${styles}</style>` : ""}
  </head>
  <body>
    ${body}
    ${scripts ? `<script>${scripts}</script>` : ""}
  </body>
</html>`;

const injectAssetsIntoHtml = (html: string, styles: string, scripts: string) => {
  let nextDocument = html;

  if (!/<head[\s>]/i.test(nextDocument)) {
    nextDocument = nextDocument.replace(
      /<html([\s>])/i,
      `<html$1><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>`,
    );
  }

  if (!/<body[\s>]/i.test(nextDocument)) {
    nextDocument = nextDocument.replace(/<\/head>/i, `</head><body>`);
    nextDocument += "</body>";
  }

  if (styles) {
    nextDocument = nextDocument.replace(/<\/head>/i, `<style>${styles}</style></head>`);
  }

  if (scripts) {
    nextDocument = nextDocument.replace(/<\/body>/i, `<script>${scripts}</script></body>`);
  }

  return nextDocument;
};

const buildPreviewDocument = (files: ProjectFile[], activeFileId: string) => {
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const htmlFile = files.find((file) => file.id === activeFileId && file.languageId === "html")
    ?? files.find((file) => file.languageId === "html");
  const cssFiles = files.filter((file) => file.languageId === "css");
  const jsFiles = files.filter((file) => file.languageId === "javascript");

  if (htmlFile) {
    const combinedStyles = cssFiles.map((file) => file.content).join("\n\n");
    const combinedScripts = jsFiles.map((file) => file.content).join("\n\n");
    const baseDocument =
      /<html[\s>]/i.test(htmlFile.content) || /<!doctype/i.test(htmlFile.content)
        ? htmlFile.content
        : wrapHtmlDocument(htmlFile.content);

    return injectAssetsIntoHtml(baseDocument, combinedStyles, combinedScripts);
  }

  if (activeFile.languageId === "css") {
    return wrapHtmlDocument(
      `<main class="preview-shell">
        <section class="card">
          <h1>VoidLAB CSS Preview</h1>
          <p>Your stylesheet is now applied to this preview canvas.</p>
          <button>Primary action</button>
        </section>
      </main>`,
      `body { margin: 0; font-family: Arial, sans-serif; background: #eff6ff; color: #0f172a; }
       .preview-shell { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
       .card { background: white; border: 1px solid #bfdbfe; border-radius: 24px; padding: 32px; box-shadow: 0 18px 48px rgba(148, 163, 184, 0.18); }
       ${activeFile.content}`,
    );
  }

  if (activeFile.languageId === "markdown") {
    return wrapHtmlDocument(
      `<article><p>${renderMarkdown(activeFile.content)}</p></article>`,
      `body { font-family: Arial, sans-serif; margin: 0; background: #eff6ff; color: #0f172a; }
       article { max-width: 760px; margin: 0 auto; padding: 48px 24px; line-height: 1.7; }
       code { background: #dbeafe; padding: 2px 6px; border-radius: 8px; }
       h1, h2, h3 { color: #1d4ed8; }`,
    );
  }

  return wrapHtmlDocument(
    `<main>
      <h1>VoidLAB Preview</h1>
      <pre>${escapeHtml(activeFile.content)}</pre>
    </main>`,
    `body { margin: 0; background: #eff6ff; color: #0f172a; font-family: Arial, sans-serif; }
     main { max-width: 980px; margin: 0 auto; padding: 32px 24px; }
     pre { white-space: pre-wrap; word-break: break-word; background: white; border: 1px solid #bfdbfe; border-radius: 20px; padding: 20px; }`,
  );
};

export const openPreview = (files: ProjectFile[], activeFileId: string) => {
  const previewHtml = buildPreviewDocument(files, activeFileId);
  const blob = new Blob([previewHtml], { type: "text/html" });
  const previewUrl = URL.createObjectURL(blob);
  const nextWindow = window.open(previewUrl, "_blank");

  if (!nextWindow) {
    URL.revokeObjectURL(previewUrl);
    throw new Error("Preview window was blocked by the browser.");
  }

  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
};
