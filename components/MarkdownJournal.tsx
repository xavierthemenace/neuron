"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addAttachment,
  deleteAttachment,
  getAttachments,
  getJournal,
  putJournal,
  type AttachmentRecord,
} from "@/lib/db";
import { newId } from "@/lib/storage";

function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => {
    const lines = markdown.split("\n");
    const out: Array<{ kind: string; text: string; level?: number }> = [];
    let inCode = false;
    let code = "";

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          out.push({ kind: "code", text: code.replace(/\n$/, "") });
          code = "";
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code += `${line}\n`;
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        out.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      } else if (/^[-*]\s+/.test(line)) {
        out.push({ kind: "bullet", text: line.replace(/^[-*]\s+/, "") });
      } else if (/^>\s?/.test(line)) {
        out.push({ kind: "quote", text: line.replace(/^>\s?/, "") });
      } else if (line.trim()) {
        out.push({ kind: "paragraph", text: line });
      } else {
        out.push({ kind: "space", text: "" });
      }
    }
    if (code) out.push({ kind: "code", text: code.replace(/\n$/, "") });
    return out;
  }, [markdown]);

  if (!markdown.trim()) {
    return <p className="text-xs text-neutral-600">Nothing written yet.</p>;
  }

  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-neutral-300">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "space") return <div key={key} className="h-1" />;
        if (block.kind === "heading") {
          const size = block.level === 1 ? "text-base" : block.level === 2 ? "text-sm" : "text-xs";
          return <div key={key} className={`${size} font-semibold text-neutral-100`}>{block.text}</div>;
        }
        if (block.kind === "bullet") {
          return <div key={key} className="flex gap-2"><span className="text-cyan-300/70">•</span><span>{block.text}</span></div>;
        }
        if (block.kind === "quote") {
          return <blockquote key={key} className="border-l-2 border-cyan-300/30 pl-3 italic text-neutral-400">{block.text}</blockquote>;
        }
        if (block.kind === "code") {
          return <pre key={key} className="overflow-x-auto rounded-lg border border-white/8 bg-black/35 p-3 font-mono text-[11px] text-neutral-300">{block.text}</pre>;
        }
        return <p key={key}>{block.text}</p>;
      })}
    </div>
  );
}

export function MarkdownJournal({ nodeId, hue }: { nodeId: string; hue: number }) {
  const [markdown, setMarkdown] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loadedNodeId, setLoadedNodeId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("idle");
    void Promise.all([getJournal(nodeId), getAttachments(nodeId)])
      .then(([journal, files]) => {
        if (cancelled) return;
        setMarkdown(journal?.markdown ?? "");
        setAttachments(files.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoadedNodeId(nodeId);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  useEffect(() => {
    if (loadedNodeId !== nodeId) return;
    const timer = window.setTimeout(() => {
      setStatus("saving");
      void putJournal({
        nodeId,
        markdown,
        updatedAt: new Date().toISOString(),
      })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loadedNodeId, markdown, nodeId]);

  async function attach(file: File) {
    const record: AttachmentRecord = {
      id: newId(),
      nodeId,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file,
    };
    await addAttachment(record);
    setAttachments((current) => [record, ...current]);
  }

  function download(record: AttachmentRecord) {
    const url = URL.createObjectURL(record.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = record.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    await deleteAttachment(id);
    setAttachments((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex items-center gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Journal</h3>
          <p className="mt-0.5 text-[9px] text-neutral-600">IndexedDB · autosaved per faculty</p>
        </div>
        <div className="ml-auto flex rounded-lg border border-white/8 bg-black/20 p-0.5">
          {(["edit", "preview"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={[
                "rounded-md px-2 py-1 text-[9px] capitalize transition-colors",
                mode === item ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-36">
        {mode === "edit" ? (
          <textarea
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="# Notes\nCapture ideas, observations, references, or learning logs…"
            aria-label="Faculty Markdown journal"
            className="min-h-40 w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-650 focus:border-white/25"
          />
        ) : (
          <div className="min-h-40 rounded-lg border border-white/8 bg-black/20 p-3">
            <MarkdownPreview markdown={markdown} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[9px] text-neutral-600">
        <span>{markdown.length.toLocaleString()} chars</span>
        <span aria-hidden="true">·</span>
        <span>{status === "saving" ? "saving…" : status === "saved" ? "saved" : status === "error" ? "storage error" : "local"}</span>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="ml-auto rounded-md border border-white/10 px-2 py-1 text-neutral-400 transition-colors hover:border-white/20 hover:text-white"
        >
          Attach file
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            for (const file of files) void attach(file);
            event.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
          {attachments.map((record) => (
            <div key={record.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 text-[10px]">
              <button type="button" onClick={() => download(record)} className="min-w-0 flex-1 truncate text-left text-neutral-300 hover:text-white">
                {record.name}
              </button>
              <span className="shrink-0 text-neutral-600">{Math.max(1, Math.round(record.size / 1024))} KB</span>
              <button type="button" onClick={() => void remove(record.id)} className="shrink-0 text-neutral-600 hover:text-red-300" aria-label={`Remove ${record.name}`}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 h-px rounded-full" style={{ background: `oklch(0.7 0.12 ${hue} / 0.24)` }} />
    </section>
  );
}
