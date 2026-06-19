export function PageLoading() {
  return (
    <section className="page-section lazy-loading-shell" aria-live="polite" aria-busy="true">
      <div className="panel lazy-loading-card">
        <div className="lazy-loading-spinner" />
        <div>
          <p className="eyebrow">Loading workspace</p>
          <h3>Preparing module</h3>
          <p className="muted">The requested page is loading on demand to keep the application faster.</p>
        </div>
      </div>
    </section>
  );
}

export default PageLoading;
