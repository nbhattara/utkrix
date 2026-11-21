import { useApiList } from "../hooks/useApiList.js";
import SectionHeading from "../components/SectionHeading.jsx";

export default function Faqs() {
  const faqs = useApiList("/faqs");

  return (
    <section id="faqs" className="section section--tint" aria-labelledby="faqs-title">
      <div className="container">
        <SectionHeading id="faqs-title" title="Frequently asked questions" intro="Helpful answers about learning with UtkriX." />

        {faqs.loading ? (
          <p className="collection-status" role="status">Loading FAQs…</p>
        ) : faqs.error ? (
          <div className="collection-status collection-status--error" role="alert">
            <p>FAQs could not be loaded: {faqs.error}</p>
            <button className="btn btn--ghost" type="button" onClick={faqs.retry}>Try again</button>
          </div>
        ) : faqs.items.length === 0 ? (
          <p className="collection-status">FAQs will appear here soon.</p>
        ) : (
          <ul className="faq-list">
            {faqs.items.map((faq) => (
              <li key={faq.id}>
                <details className="faq-item">
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
