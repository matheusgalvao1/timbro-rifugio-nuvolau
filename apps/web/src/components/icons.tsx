import type { SVGProps } from 'react'

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M7 4.5 19 12 7 19.5Z" fill="currentColor" stroke="none" />
  </Base>
)

export const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" />
  </Base>
)

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Base>
)

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
  </Base>
)

export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
)

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3v11m0 0-4-4m4 4 4-4M4 21h16" />
  </Base>
)

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 18-6-6 6-6" />
  </Base>
)

export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m9 18 6-6-6-6" />
  </Base>
)

export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)

export const GearIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
)

export const LogOutIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Base>
)

export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Base>
)

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m5 13 4 4 10-11" />
  </Base>
)

export const KeyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M15 7l3 3" />
  </Base>
)

export const PowerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 2v9M6.1 6.1a8 8 0 1 0 11.8 0" />
  </Base>
)

export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 5v14M15 5v14" />
  </Base>
)

export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Base>
)

export const UserPlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6M19 8v6M22 11h-6" />
  </Base>
)
