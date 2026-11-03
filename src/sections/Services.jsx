import { services } from "../data/services.js";
import Icon from "../components/Icon.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import PlaceholderNote from "../components/PlaceholderNote.jsx";

export default function Services() {
  return (
    <section id="services" className="section" aria-labelledby="services-title">
      <div className="container">
        <SectionHeading id="services-title" title="What we do" intro="Services and capabilities." />
        <PlaceholderNote>Placeholder content. Service descriptions will be replaced with real company information.</PlaceholderNote>
        <ul className="services">
          {services.map((s) => (
            <li key={s.title}>
              <span className="services__icon"><Icon name={s.icon} /></span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
