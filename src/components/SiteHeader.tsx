import type { ReactNode } from 'react'
import { href } from '../lib/router'

export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <a className="brand" href={href()}>
          <img className="brand__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="30" height="30" />
          <span className="brand__name">Virgil</span>
        </a>
        {children}
      </div>
    </header>
  )
}
