import DOMPurify from 'dompurify'
import { marked } from 'marked'

// Renders a help guide written in Markdown (sanitised).
export function Markdown({ text }) {
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(text ?? '')) }} />
}
