import { mvg } from "../data/mvg.js";
import SectionHeading from "../components/SectionHeading.jsx";

export default function MissionVision() {
  return (
    <section id="mission" className="section section--tint" aria-labelledby="mission-title">
      <div className="container">
        <SectionHeading id="mission-title" title="Mission, vision and goals" />
        <div className="mvg">
          <article>
            <h3>{mvg.mission.title}</h3>
            <p>{mvg.mission.text}</p>
          </article>
          <article>
            <h3>{mvg.vision.title}</h3>
            <p>{mvg.vision.text}</p>
          </article>
          <article>
            <h3>{mvg.goals.title}</h3>
            <ul>
              {mvg.goals.items.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
