import { Sun, CloudRain, MapPin, CalendarDays } from 'lucide-react'

export function WeatherWidget({ destination }) {
  const isRainy = destination.toLowerCase().includes('jogja') || destination.toLowerCase().includes('yogyakarta')
  const temp = isRainy ? '27 C' : '30 C'
  const condition = isRainy ? 'Hujan Ringan' : 'Cerah Berawan'

  return (
    <div className="animate-fade-in rounded-lg border border-slate-200/80 bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cuaca Saat Ini</span>
          <h3 className="mt-1 truncate text-sm font-extrabold text-slate-900">{destination}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">{condition}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isRainy ? (
            <CloudRain className="h-8 w-8 text-cyan-500" />
          ) : (
            <Sun className="h-8 w-8 text-amber-400" />
          )}
          <span className="text-2xl font-black text-slate-950">{temp}</span>
        </div>
      </div>
    </div>
  )
}

export function MapWidget({ destination, coordinates }) {
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&t=&z=13&ie=UTF8&iwloc=&output=embed`

  return (
    <div className="animate-fade-in overflow-hidden rounded-lg border border-slate-200/80 bg-white/70 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/75 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="truncate text-xs font-extrabold text-slate-900">{destination}</span>
        </div>
        <span className="hidden shrink-0 font-mono text-[9px] text-slate-400 sm:inline">{coordinates || 'S: 8.4095, E: 115.1889'}</span>
      </div>
      <div className="relative h-[180px] w-full">
        <iframe
          title={`Peta ${destination}`}
          src={mapUrl}
          className="h-full w-full border-0"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  )
}

export function ItineraryWidget({ items }) {
  return (
    <div className="animate-fade-in rounded-lg border border-slate-200/80 bg-white/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-teal-600" />
        <span className="text-xs font-extrabold text-slate-900">Rencana Perjalanan</span>
      </div>
      <div className="space-y-4 border-l border-teal-200 pl-4">
        {items.map((item, index) => (
          <div key={`${item.time}-${index}`} className="relative">
            <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal-500 shadow" />
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">{item.time}</span>
            <h4 className="mt-0.5 text-xs font-extrabold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
