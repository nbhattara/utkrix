import { useEffect, useState } from "react";
import { getApi } from "../api/client.js";
import { team as fallbackTeam } from "../data/team.js";
import { assets } from "../config/site.js";
import SectionHeading from "../components/SectionHeading.jsx";

const initials = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");

export default function About() {
  const [members, setMembers] = useState(fallbackTeam);

  useEffect(() => {
    let active = true;
    getApi("/team-members")
      .then((result) => {
        const list = Array.isArray(result) ? result : [];
        if (active && list.length) {
          setMembers(list.map((m) => ({
            name: m.name,
            role: m.title,
            photo: m.photoUrl || undefined,
            bio: m.bio || undefined,
          })));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <div className="container">
        <SectionHeading id="about-title" title="About UtkriX" />
        <div className="about__grid">
          <div className="about__text">
            <p>UtkriX Technologies is an IT company helping businesses and learners grow through websites, mobile apps, AI solutions, cloud services, and digital transformation.</p>
          </div>
          <figure className="about__figure">
            <img src={assets.banner} alt="UtkriX Technologies: your trusted IT partner, with website development, mobile apps, AI, cloud, security, UI/UX, IT consulting and digital transformation services" width="2034" height="773" loading="lazy" />
          </figure>
        </div>

        <h3 className="subhead" id="team-title">Our team</h3>
        <ul className="team" aria-labelledby="team-title">
          {members.map((m) => (
            <li key={m.name}>
              {m.photo ? (
                <img className="team__photo" src={m.photo} alt={`Photo of ${m.name}`} width="96" height="96" loading="lazy" />
              ) : (
                <span className="team__photo team__photo--initials" aria-hidden="true">{initials(m.name)}</span>
              )}
              <h4>{m.name}</h4>
              <p>{m.role}</p>
              {m.bio ? <p className="team__bio">{m.bio}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
