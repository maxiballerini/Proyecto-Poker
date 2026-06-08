export default function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-700 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
      {msg}
    </div>
  )
}
