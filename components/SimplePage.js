export default function SimplePage({ title, body }) {
  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p className="lead">{body}</p>
    </section>
  );
}
