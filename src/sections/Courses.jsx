import { useEffect, useState } from "react";
import { getMediaUrl } from "../api/client.js";
import { useApiList } from "../hooks/useApiList.js";
import SectionHeading from "../components/SectionHeading.jsx";

const PAGE_SIZE = 9;
const currency = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 2,
});

export default function Courses() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const categories = useApiList("/courses/categories");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) params.set("search", search);
  if (category) params.set("category", category);

  const courses = useApiList(`/courses?${params.toString()}`);

  return (
    <section id="courses" className="section section--tint" aria-labelledby="courses-title">
      <div className="container">
        <SectionHeading
          id="courses-title"
          title="Explore our courses"
          intro="Practical learning paths published by our instructors."
        />

        <form className="catalog-filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span>Search courses</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Try web development"
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.items.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </form>

        {courses.loading ? (
          <p className="collection-status" role="status">Loading courses…</p>
        ) : courses.error ? (
          <div className="collection-status collection-status--error" role="alert">
            <p>Courses could not be loaded: {courses.error}</p>
            <button className="btn btn--ghost" type="button" onClick={courses.retry}>Try again</button>
          </div>
        ) : courses.items.length === 0 ? (
          <p className="collection-status" role="status">
            {search || category ? "No published courses match these filters." : "Courses will appear here as soon as they are published."}
          </p>
        ) : (
          <>
            <ul className="projects course-grid">
              {courses.items.map((course) => (
                <li key={course.id}>
                  <article className="card course-card">
                    {course.thumbnail ? (
                      <img
                        className="course-card__image"
                        src={getMediaUrl(course.thumbnail)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="course-card__placeholder" aria-hidden="true">
                        <span>{course.category}</span>
                      </div>
                    )}
                    <div className="card__body">
                      <ul className="tags" aria-label="Course category">
                        <li>{course.category}</li>
                      </ul>
                      <h3>{course.title}</h3>
                      <p className="course-card__description">{course.description}</p>
                      <div className="course-card__meta">
                        <span>{course.instructor?.name || "UtkriX instructor"}</span>
                        <strong>{currency.format(Number(course.price) || 0)}</strong>
                      </div>
                      <a className="btn btn--ghost" href="#contact">Ask about this course</a>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {courses.totalPages > 1 && (
              <nav className="catalog-pagination" aria-label="Course pages">
                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span aria-live="polite">Page {page} of {courses.totalPages}</span>
                <button
                  className="btn btn--ghost"
                  type="button"
                  disabled={page >= courses.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}

        {categories.error && (
          <p className="collection-status collection-status--error" role="status">
            Course categories could not be loaded: {categories.error}
          </p>
        )}
      </div>
    </section>
  );
}
