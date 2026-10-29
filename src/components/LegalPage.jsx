import { useEffect, useRef } from "react";

// Renders a legal document from src/data/*.js. The text is shown exactly as supplied.
function Block({ b }) {
  switch (b.t) {
    case "h": return <h3>{b.text}</h3>;
    case "p": return <p>{b.text}</p>;
    case "ul": return <ul>{b.items.map((i) => <li key={i}>{i}</li>)}</ul>;
    case "lines": return <p className="legal__lines">{b.items.map((l) => <span key={l}>{l}</span>)}</p>;
    case "kv": return <dl className="legal__kv">{b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
    default: return null;
  }
}

export default function LegalPage({ doc, slug }) {
  const h1 = useRef(null);
  useEffect(() => {
    document.title = `${doc.title} | UtkriX Technologies`;
    h1.current?.focus({ preventScroll: true });
    return () => { document.title = "UtkriX Technologies | Your Trusted IT Partner"; };
  }, [doc]);

  return (
    <div className="container legal">
      <aside className="legal__toc">
        <details open>
          <summary>Contents</summary>
          <nav aria-label={`${doc.title} contents`}>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}><a href={`#/${slug}`} onClick={(e) => { e.preventDefault(); document.getElementById(`${slug}-${s.id}`)?.scrollIntoView(); }}>{s.id}. {s.title}</a></li>
              ))}
            </ol>
          </nav>
        </details>
      </aside>

      <article className="legal__doc">
        <header>
          <h1 ref={h1} tabIndex={-1}>{doc.title}</h1>
          {doc.subtitle && <p className="legal__subtitle">{doc.subtitle}</p>}
          <dl className="legal__kv legal__meta">
            {doc.meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p>{doc.intro}</p>
        </header>
        {doc.sections.map((s) => (
          <section key={s.id} id={`${slug}-${s.id}`} aria-labelledby={`${slug}-${s.id}-t`}>
            <h2 id={`${slug}-${s.id}-t`}>{s.id}. {s.title}</h2>
            {s.blocks.map((b, i) => <Block key={i} b={b} />)}
          </section>
        ))}
      </article>
    </div>
  );
}
