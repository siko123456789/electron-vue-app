import MarkdownIt from 'markdown-it'

const renderer = new MarkdownIt({ html: false, breaks: true, linkify: true })

/** 将 AI Markdown 文本渲染为面板展示 HTML。 */
export function renderAiMarkdown(value: unknown) {
  return renderer.render(String(value ?? ''))
}
