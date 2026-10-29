import { assets, company } from "../config/site.js";

export default function Hero() {
  return (
    <section id="home" className="hero" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <div className="hero__copy">
          <h1 id="hero-title">{company.name}</h1>
          {/* TAGLINE PLACEHOLDER: edit company.tagline in src/config/site.js */}
          <p className="hero__tagline">{company.tagline}. Custom software, modern web and smart solutions for your business.</p>

          <div className="hero__cta">
            <a className="btn btn--primary" href="#contact">Start a project</a>
            <a className="btn btn--ghost" href="#projects">View projects</a>
          </div>

          <ol className="steps" aria-label="How we work">
            {company.motto.map((word, i) => (
              <li key={word}>
                <span className="steps__n" aria-hidden="true">{i + 1}</span>
                {word}
              </li>
            ))}
          </ol>
        </div>

        <div className="hero__art" aria-hidden="true">
          <div className="hero__plate" />
          <img src={assets.logoMark} alt="" width="652" height="507" />
        </div>
      </div>
    </section>
  );
}
