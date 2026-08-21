import { LoadingState } from './ui/SystemState';

export function PageLoading() {
  return (
    <section className="page-section lazy-loading-shell" aria-live="polite" aria-busy="true">
      <LoadingState label="Preparing module" rows={5} />
    </section>
  );
}

export default PageLoading;
