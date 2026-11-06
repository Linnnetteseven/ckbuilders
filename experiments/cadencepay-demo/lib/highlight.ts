import { createHighlighter, type Highlighter, type ThemeRegistrationRaw } from "shiki";

/** CadencePay's own colours. Every one passes WCAG AA (4.5:1) on the code background, --color-soft. */
const THEME: ThemeRegistrationRaw = {
  name: "cadencepay",
  type: "light",
  settings: [
    { settings: { foreground: "#181512", background: "#00000000" } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#6B645E", fontStyle: "italic" } },
    { scope: ["keyword", "storage", "keyword.operator.new", "keyword.control", "variable.language"], settings: { foreground: "#A63A56" } },
    { scope: ["string", "string.quoted", "string.template", "string.unquoted"], settings: { foreground: "#2B6C50" } },
    { scope: ["constant.numeric", "constant.language", "constant.character", "keyword.other.unit"], settings: { foreground: "#8A5A00" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call", "entity.name.command"], settings: { foreground: "#3A4BC4" } },
    { scope: ["entity.name.type", "support.type", "support.class", "entity.name.class"], settings: { foreground: "#8A5A00" } },
    { scope: ["punctuation", "keyword.operator", "meta.brace"], settings: { foreground: "#5C5650" } },
    { scope: ["variable.parameter.option", "constant.other.option"], settings: { foreground: "#A63A56" } },
  ],
};

export type CodeLang = "ts" | "bash";

let highlighter: Promise<Highlighter> | undefined;
const getHighlighter = () => (highlighter ??= createHighlighter({ themes: [THEME], langs: ["ts", "bash"] }));

/** A highlighted <pre> as HTML. Server only, and only ever given snippets written in this repo. */
export async function highlight(code: string, lang: CodeLang): Promise<string> {
  return (await getHighlighter()).codeToHtml(code.trim(), { lang, theme: "cadencepay" });
}

/** Highlighted spans with no <pre>, for a single command inside a line. */
export async function highlightInline(code: string, lang: CodeLang): Promise<string> {
  return (await getHighlighter()).codeToHtml(code.trim(), { lang, theme: "cadencepay", structure: "inline" });
}
