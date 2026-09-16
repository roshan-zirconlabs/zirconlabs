// Static CSS nebula and starfield for app pages: painted once, no script, no animation.
export default function CosmosBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 transform-gpu">
      <div className="c-backdrop absolute inset-0" />
      <div className="c-stars absolute inset-0" />
      <div className="c-stars-far absolute inset-0" />
    </div>
  );
}
