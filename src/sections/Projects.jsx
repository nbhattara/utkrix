import { projects } from "../data/projects.js";
import SectionHeading from "../components/SectionHeading.jsx";
import PlaceholderNote from "../components/PlaceholderNote.jsx";

export default function Projects() {
  return (
    <section id="projects" className="section" aria-labelledby="projects-title">
      <div className="container">
        <SectionHeading id="projects-title" title="Projects" intro="A selection of our work." />
        <PlaceholderNote>Placeholder projects. Edit src/data/projects.js to add real ones.</PlaceholderNote>
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.id}>
              <article className="card">
                <img src={p.image} alt={p.alt} width="800" height="500" loading="lazy" />
                <div className="card__body">
                  <ul className="tags" aria-label="Project type">
                    {p.tags.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
