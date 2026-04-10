import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children?: string | null;
  className?: string;
}

/**
 * Render a limited subset of Markdown safely. Used for long-text fields in
 * hosted page sections (about.text, faq.answer, testimonial.quote, etc.) so
 * agents can include bold, italic, links, lists, and inline code without
 * writing JSX or custom CSS.
 *
 * Safety:
 *   - react-markdown escapes raw HTML by default; we do not enable
 *     rehype-raw, so `<script>` and other tags render as literal text.
 *   - Link URLs are filtered to safe protocols only (http, https, mailto,
 *     tel, and hash anchors).
 *   - Headings are constrained to h3/h4 — h1/h2 are reserved for section
 *     titles so agent markdown cannot compete with the page hierarchy.
 */

const SAFE_URL_RE = /^(https?:|mailto:|tel:|#)/i;

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return SAFE_URL_RE.test(url) ? url : undefined;
}

export function Prose({ children, className }: Props) {
  if (!children || !children.trim()) return null;

  return (
    <div
      className={
        className ??
        "prose prose-sm md:prose-base max-w-none prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Demote any h1/h2 an agent writes to h3 to keep the section
          // hierarchy intact.
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          // External links open in a new tab; mailto/tel/anchor stay inline.
          a: ({ href, children }) => {
            const safe = sanitizeUrl(href);
            if (!safe) return <>{children}</>;
            const external = /^https?:\/\//i.test(safe);
            return (
              <a
                href={safe}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
