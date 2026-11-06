import { highlight, type CodeLang } from "@/lib/highlight";
import { CopyButton } from "./CopyButton";

/** A syntax-highlighted code block with a copy button. */
export async function Code({ children, lang }: { children: string; lang: CodeLang }) {
  const html = await highlight(children, lang);
  return (
    <div className="not-prose relative my-5 rounded-2xl bg-soft border border-line overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line font-mono text-[11px] tracking-[0.12em] uppercase text-ink-3">
        <span>{lang}</span>
        <CopyButton text={children.trim()} />
      </div>
      <div className="code-block px-4 py-4 font-mono text-[13px] leading-[1.7]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
