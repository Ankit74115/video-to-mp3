/** Fixed page backdrop: layered radial gradients plus a faint grain layer. */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="scene pointer-events-none fixed inset-0 -z-10">
      <div className="grain absolute inset-0 opacity-[0.07] mix-blend-multiply" />
    </div>
  )
}
