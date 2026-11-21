import { useEffect, useState } from "react";
import { getApi } from "../api/client.js";
import SectionHeading from "../components/SectionHeading.jsx";

export default function Faqs() {
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    let active = true;
    getApi("/faqs")
      .then((result) => {
        if (active && Array.isArray(result)) setFaqs(result);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!faqs.length) return null;

  return (
    <section id="faqs" className="section section--tint" aria-labelledby="faqs-title">
      <div className="container">
        <SectionHeading id="faqs-title" title="Frequently asked questions" />
        <div className="faq-list">
          {faqs.map((faq) => (
            <details className="faq-item" key={faq.id}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
