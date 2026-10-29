import { about } from "../data/about.js";
import { team } from "../data/team.js";
import { assets } from "../config/site.js";
import SectionHeading from "../components/SectionHeading.jsx";
import PlaceholderNote from "../components/PlaceholderNote.jsx";

const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

export default function About() {
  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <div className="container">
        <SectionHeading id="about-title" title="About UtkriX" />
        <PlaceholderNote>Placeholder text. Replace with the real company story.</PlaceholderNote>
        <div className="about__grid">
          <div className="about__text">
            {about.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </div>
          <figure className="about__figure">
            <img src={assets.banner} alt="UtkriX Technologies: your trusted IT partner, with website development, mobile apps, AI, cloud, security, UI/UX, IT consulting and digital transformation services" width="2034" height="773" loading="lazy" />
          </figure>
        </div>

        <h3 className="subhead" id="team-title">Our team</h3>
        <PlaceholderNote>Placeholder team members. Replace names, roles and add photos.</PlaceholderNote>
        <ul className="team" aria-labelledby="team-title">
          {team.map((m) => (
            <li key={m.name}>
              {m.photo ? (
                <img className="team__photo" src={m.photo} alt={`Photo of ${m.name}`} width="96" height="96" loading="lazy" />
              ) : (
                <span className="team__photo team__photo--initials" aria-hidden="true">{initials(m.name)}</span>
              )}
              <h4>{m.name}</h4>
              <p>{m.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
