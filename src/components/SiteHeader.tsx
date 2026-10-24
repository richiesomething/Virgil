import type { ReactNode } from 'react'
import { href } from '../lib/router'

export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <a className="brand" href={href()}>
          <span className="brand__mark" aria-hidden="true">V</span>
          <span className="brand__name">Virgil</span>
        </a>
        {children}
      </div>
    </header>
  )
}
