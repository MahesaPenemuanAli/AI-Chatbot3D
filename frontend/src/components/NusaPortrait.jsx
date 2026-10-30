import { useId } from 'react'

// Lightweight matching illustration while the rig downloads / when WebGL is absent.
export default function NusaPortrait({ style, framing = 'full', ...props }) {
  const id = useId().replace(/:/g, '')
  return <svg viewBox={framing === 'conversation' ? '0 0 320 420' : '0 0 320 560'} role="img" aria-label="Nusa, teman wanita bergaya anime" style={style} {...props}>
    <defs><linearGradient id={`${id}-hair`} x2=".8" y2="1"><stop stopColor="#715340"/><stop offset="1" stopColor="#3c2c30"/></linearGradient><linearGradient id={`${id}-shirt`} x2="1" y2="1"><stop stopColor="#dedaff"/><stop offset="1" stopColor="#a59acb"/></linearGradient></defs>
    <ellipse cx="160" cy="537" rx="59" ry="8" fill="#72678c" opacity=".08"/>
    <path d="M119 311 124 415 130 507 147 509 153 407 158 326ZM162 326 167 410 176 509 193 507 195 414 202 311" fill="#f2d6c8"/>
    <path d="m129 501-10 25q0 11 32 6l2-28Zm45 3 1 29q30 5 33-7l-16-25Z" fill="#413a4a"/>
    <path d="M112 283q48-12 96 0l-7 60-40 2-3-20-3 20-39-2Z" fill="#403b4e"/>
    <path d="M117 83q-15 17-13 57l-1 104 28-8 69 6 20-13-9-101q1-42-28-54Z" fill={`url(#${id}-hair)`}/>
    <path d="m113 180-9 62-9 67q-3 13 7 15 9-1 9-15l13-68 12-54Zm83 6 13 57 4 61q-2 17 7 19 10 0 9-17l-4-68-8-57Z" fill="#f2d6c8"/>
    <path d="m138 151-24 13-13 41 25 8 2-20-8 101q41 14 83-1l-8-101 4 20 27-11-15-37-30-13Z" fill={`url(#${id}-shirt)`}/>
    <path d="m147 130-2 26q15 16 32-1l-4-27" fill="#efd0be"/>
    <path d="M122 94q0-37 39-38 40 1 40 39l-5 37q-14 26-35 29-22-4-34-29Z" fill="#f9e2d5"/>
    <path d="M116 107q-9-52 39-54 51-6 52 59-37-5-55-31-9 22-36 26" fill={`url(#${id}-hair)`}/>
    <path d="M128 115q10-7 19 0m29 0q9-7 18 0" stroke="#6b4c42" strokeWidth="3" fill="none"/>
    <ellipse cx="139" cy="119" rx="5.5" ry="8" fill="#705340"/><ellipse cx="184" cy="119" rx="5.5" ry="8" fill="#705340"/>
    <ellipse cx="140" cy="116" rx="2" ry="3" fill="#fff"/><ellipse cx="185" cy="116" rx="2" ry="3" fill="#fff"/>
    <ellipse cx="135" cy="132" rx="8" ry="3" fill="#df9a93" opacity=".3"/><ellipse cx="189" cy="132" rx="8" ry="3" fill="#df9a93" opacity=".3"/>
    <path d="M153 140q8 7 16-1" fill="none" stroke="#bf7e7c" strokeWidth="2" strokeLinecap="round"/>
    <path d="M119 104q-9 65 6 119l8-2q-12-58-4-113m65-14q16 84 0 137l11 4q22-64 3-132" fill={`url(#${id}-hair)`}/>
  </svg>
}
