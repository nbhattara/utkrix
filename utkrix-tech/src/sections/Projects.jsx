import { useState } from "react";
import { getMediaUrl } from "../api/client.js";
import { useApiList } from "../hooks/useApiList.js";
import SectionHeading from "../components/SectionHeading.jsx";

export default function Projects() {
  const [page, setPage] = useState(1);
  const projects = useApiList(`/projects?page=${page}&limit=9`);

  return (
    <section id="projects" className="section" aria-labelledby="projects-title">
      <div className="container">
        <SectionHeading id="projects-title" title="Projects" intro="A selection of our published work." />

        {projects.loading ? (
          <p className="collection-status" role="status">Loading projects…</p>
        ) : projects.error ? (
          <div className="collection-status collection-status--error" role="alert">
            <p>Projects could not be loaded: {projects.error}</p>
            <button className="btn btn--ghost" type="button" onClick={projects.retry}>Try again</button>
          </div>
        ) : projects.items.length === 0 ? (
          <p className="collection-status" role="status">Published projects will appear here.</p>
        ) : (
          <>
            <ul className="projects">
              {projects.items.map((project) => (
                <li key={project.id}>
                  <article className="card">
                    {project.imageUrl ? (
                      <img src={getMediaUrl(project.imageUrl)} alt="" loading="lazy" />
                    ) : (
                      <div className="project-card__placeholder" aria-hidden="true">
                        <span>{project.category}</span>
                      </div>
                    )}
                    <div className="card__body">
                      {Array.isArray(project.tags) && project.tags.length > 0 && (
                        <ul className="tags" aria-label="Project technologies">
                          {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
                        </ul>
                      )}
                      <h3>{project.title}</h3>
                      <p>{project.description}</p>
                      {project.projectUrl && (
                        <a href={project.projectUrl} target="_blank" rel="noreferrer">
                          View project<span className="sr-only">: {project.title}</span>
                        </a>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {projects.totalPages > 1 && (
              <nav className="catalog-pagination" aria-label="Project pages">
                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span aria-live="polite">Page {page} of {projects.totalPages}</span>
                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={page >= projects.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
