import React from 'react'
import { Sun, CloudRain, MapPin, Calendar, Clock, Navigation } from 'lucide-react'

export function WeatherWidget({ destination }) {
  const isRainy = destination.toLowerCase().includes('jogja') || destination.toLowerCase().includes('yogyakarta')
  const temp = isRainy ? '27°C' : '30°C'
  const condition = isRainy ? 'Hujan Ringan' : 'Cerah Berawan'
  
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between my-3 animate-fade-in">
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cuaca Saat Ini</span>
        <span className="text-sm font-bold text-white mt-0.5">{destination}</span>
        <span className="text-xs text-gray-400 mt-1">{condition}</span>
      </div>
      <div className="flex items-center gap-3">
        {isRainy ? (
          <CloudRain className="w-8 h-8 text-cyan-400 animate-bounce" style={{ animationDuration: '3s' }} />
        ) : (
          <Sun className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '12s' }} />
        )}
        <span className="text-2xl font-extrabold text-white">{temp}</span>
      </div>
    </div>
  )
}

export function MapWidget({ destination, coordinates }) {
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&t=&z=13&ie=UTF8&iwloc=&output=embed`

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden my-3 bg-black/30 animate-fade-in">
      <div className="p-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">{destination}</span>
        </div>
        <span className="text-[9px] text-gray-500 font-mono">{coordinates || 'S: 8.4095, E: 115.1889'}</span>
      </div>
      <div className="w-full h-[200px] relative">
        <iframe 
          title="Peta Lokasi"
          src={mapUrl} 
          className="w-full h-full border-0 grayscale invert opacity-80"
          allowFullScreen="" 
          loading="lazy"
        ></iframe>
      </div>
    </div>
  )
}

export function ItineraryWidget({ items }) {
  return (
    <div className="my-4 space-y-4 border-l border-white/10 ml-3.5 pl-5 animate-fade-in">
      {items.map((item, index) => (
        <div key={index} className="relative">
          <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-[#050b0a] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#050b0a]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{item.time}</span>
            <span className="text-xs font-bold text-white mt-0.5">{item.title}</span>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
