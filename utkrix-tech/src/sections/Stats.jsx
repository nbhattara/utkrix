import { useApiList } from "../hooks/useApiList.js";

export default function Stats() {
  const stats = useApiList("/stats");

  if (!stats.loading && !stats.error && stats.items.length === 0) return null;

  return (
    <section className="section section--tint" aria-label="Company in numbers">
      <div className="container">
        {stats.loading ? <p className="collection-status" role="status">Loading company statistics…</p>
          : stats.error ? (
            <div className="collection-status collection-status--error" role="alert">
              <p>Company statistics could not be loaded: {stats.error}</p>
              <button className="btn btn--ghost" type="button" onClick={stats.retry}>Try again</button>
            </div>
          ) : (
            <dl className="stats">
              {stats.items.map((stat) => (
                <div key={stat.id}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
      </div>
    </section>
  );
}
