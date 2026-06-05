export default function AmountDisplay({ centavos, className = '' }) {
  const formatted = (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })
  return (
    <span className={className}>
      $ {formatted}
    </span>
  )
}
