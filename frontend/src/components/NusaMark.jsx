/** A compass and a growing leaf: Nusa's own travel emblem. */
export default function NusaMark({ size = 24, strokeWidth = 1.6, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M25.8 12.1a11 11 0 1 1-6-6.1"/>
    <path d="m12 20 2.4-7.6L22 10l-2.4 7.6L12 20Z"/>
    <path d="m14.4 12.4 5.2 5.2M6 16H4m12 10v2"/>
    <path d="M22 10c-1.1-4.1 1.8-6.1 6-6-0.1 4.1-2 7.1-6 6Z"/>
  </svg>
}
