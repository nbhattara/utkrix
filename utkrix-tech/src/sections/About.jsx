import { about } from "../data/about.js";
import { assets } from "../config/site.js";
import SectionHeading from "../components/SectionHeading.jsx";
import PlaceholderNote from "../components/PlaceholderNote.jsx";
import { useApiList } from "../hooks/useApiList.js";
import { getMediaUrl } from "../api/client.js";

const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

export default function About() {
  const team = useApiList("/team-members");

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
        {team.loading ? (
          <p className="collection-status" role="status">Loading team…</p>
        ) : team.error ? (
          <div className="collection-status collection-status--error" role="alert">
            <p>Team members could not be loaded: {team.error}</p>
            <button className="btn btn--ghost" type="button" onClick={team.retry}>Try again</button>
          </div>
        ) : team.items.length === 0 ? (
          <p className="collection-status">Our team will be introduced here soon.</p>
        ) : (
          <ul className="team" aria-labelledby="team-title">
            {team.items.map((member) => (
              <li key={member.id}>
                {member.photoUrl ? (
                  <img className="team__photo" src={getMediaUrl(member.photoUrl)} alt={`Photo of ${member.name}`} width="96" height="96" loading="lazy" />
                ) : (
                  <span className="team__photo team__photo--initials" aria-hidden="true">{initials(member.name)}</span>
                )}
                <h4>{member.name}</h4>
                <p>{member.title}</p>
                {member.bio && <p>{member.bio}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
